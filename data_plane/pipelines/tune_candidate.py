"""Compare ridge models on inner spatial folds; evaluate one selected candidate."""

import argparse
import json
import math
import os
import re
from typing import Any

from .train_candidate import (
    BigQuery, FEATURES, TrainingRun, code_manifest, quality_warnings, run_id, validate_namespace,
)


REGULARIZATION = (0, 1000, 10000)
FOLDS = 3
COLUMNS = ", ".join(FEATURES)


def fold_data(table: str, fold: int) -> str:
    if fold not in range(FOLDS):
        raise ValueError("Invalid spatial fold.")
    return f"""SELECT *, temp_f - AVG(IF(inner_fold != {fold}, temp_f, NULL)) OVER ()
      AS fold_offset_f FROM `{table}`"""


def fit_sql(model: str, table: str, fold: int, l2: int) -> str:
    if l2 not in REGULARIZATION:
        raise ValueError("Unsupported regularization.")
    return f"""CREATE MODEL `{model}`
      OPTIONS (MODEL_TYPE='LINEAR_REG', INPUT_LABEL_COLS=['offset_f'],
        DATA_SPLIT_METHOD='NO_SPLIT', L2_REG={l2}, ENABLE_GLOBAL_EXPLAIN=TRUE) AS
      SELECT {COLUMNS}, fold_offset_f AS offset_f
      FROM ({fold_data(table, fold)}) WHERE inner_fold != {fold}"""


def validation_sql(model: str, table: str, fold: int) -> str:
    return f"""SELECT * FROM ML.EVALUATE(MODEL `{model}`, (
      SELECT {COLUMNS}, fold_offset_f AS offset_f
      FROM ({fold_data(table, fold)}) WHERE inner_fold = {fold}
    ))"""


def select_configuration(results: list[dict[str, Any]]) -> dict[str, Any]:
    if len(results) != len(REGULARIZATION) * FOLDS:
        raise ValueError("Incomplete cross-validation experiment.")
    scores = []
    for l2 in REGULARIZATION:
        rows = [row for row in results if row["l2"] == l2]
        if {row["fold"] for row in rows} != set(range(FOLDS)) or len(rows) != FOLDS:
            raise ValueError("Missing or repeated spatial fold.")
        values = [float(row["metrics"]["mean_squared_error"]) for row in rows]
        if any(not math.isfinite(value) or value < 0 for value in values):
            raise ValueError("Invalid cross-validation MSE.")
        scores.append({"l2": l2, "mean_fold_mse": sum(values) / FOLDS})
    selected = min(scores, key=lambda score: (score["mean_fold_mse"], -score["l2"]))
    return {"selected_l2": selected["l2"], "scores": scores}


def tune(training: TrainingRun, parent_run: str) -> dict[str, Any]:
    if not re.fullmatch(r"[0-9]{8}_[0-9]{6}_[a-f0-9]{12}", parent_run):
        raise ValueError("Invalid parent run ID.")
    parent_rows = training.bq.query(
        f"""SELECT payload FROM `{training.events}` WHERE run_id=@parent
        AND stage='run' AND state='VALIDATED_CANDIDATE' ORDER BY event_time DESC LIMIT 1""",
        "parent", (f"parent:STRING:{parent_run}",),
    )
    if len(parent_rows) != 1:
        raise ValueError("Parent must be a validated candidate with preserved training features.")
    payload = parent_rows[0]["payload"]
    parent = json.loads(payload) if isinstance(payload, str) else payload
    expected = f"{training.namespace}.training_data_{parent_run}"
    if parent["feature_table"] != expected:
        raise ValueError("Parent feature table does not match the expected versioned resource.")
    training.context["heat_source"] = f"{training.namespace}.heat_snapshot_{parent_run}"
    training.context["tract_source"] = f"{training.namespace}.tract_snapshot_{parent_run}"
    training.context["feature_table"] = f"{training.namespace}.tuning_features_{training.identifier}"
    cv_table = f"{training.namespace}.inner_folds_{training.identifier}"
    active_name = f"{training.namespace}.heat_offset_model"
    active_before = training.bq.model(active_name)
    training.event("run", "STARTED", {
        **code_manifest(), "parent_run": parent_run, **training.context,
        "regularization_grid": REGULARIZATION, "folds": FOLDS,
        "selection_rule": "Lowest equal-fold mean validation MSE; ties prefer stronger L2.",
        "outer_holdout_previously_inspected": True,
        "excluded_inputs": "Heat aggregates, heat risk scores, humidity, SVI, race and ethnicity.",
        "reference_time": training.reference_time,
    })
    try:
        training.execute(
            "feature_snapshot",
            f"""CREATE SNAPSHOT TABLE `{training.context['feature_table']}` CLONE `{expected}`
            FOR SYSTEM_TIME AS OF @reference_time""",
            training.parameters, fetch_rows=False,
        )
        training.execute(
            "inner_split",
            f"""CREATE TABLE `{cv_table}` AS SELECT *,
              MOD(MOD(FARM_FINGERPRINT(CONCAT('inner:', spatial_cell)), 3) + 3, 3) AS inner_fold
            FROM `{training.context['feature_table']}` WHERE NOT is_eval""",
            fetch_rows=False,
        )
        stats = training.execute(
            "inner_checks",
            f"""SELECT inner_fold, COUNT(*) AS row_count, COUNT(DISTINCT spatial_cell) AS cells,
              COUNTIF(is_eval) AS outer_rows
            FROM `{cv_table}` GROUP BY inner_fold ORDER BY inner_fold""",
        )
        if (
            {int(row["inner_fold"]) for row in stats} != set(range(FOLDS))
            or any(int(row["cells"]) < 2 or int(row["outer_rows"]) != 0 for row in stats)
        ):
            raise ValueError(f"Invalid inner spatial folds: {stats}")
        results = []
        for l2 in REGULARIZATION:
            for fold in range(FOLDS):
                name = f"{training.namespace}.ridge_{training.identifier}_l2_{l2}_f{fold}"
                training.execute(
                    f"fit_l2_{l2}_f{fold}", fit_sql(name, cv_table, fold, l2), fetch_rows=False,
                )
                metrics = training.execute(
                    f"score_l2_{l2}_f{fold}", validation_sql(name, cv_table, fold),
                )[0]
                results.append({"l2": l2, "fold": fold, "metrics": metrics})
        selection = select_configuration(results)
        training.event("selection", "SUCCEEDED", {**selection, "fold_results": results})
        # Selection is persisted before any query scores the selected model on the outer holdout.
        sql = training.template("train_model.sql").replace(
            "ENABLE_GLOBAL_EXPLAIN = TRUE",
            f"L2_REG = {selection['selected_l2']},\n  ENABLE_GLOBAL_EXPLAIN = TRUE",
        )
        training.execute("train", sql, fetch_rows=False)
        training.event("model_metadata", "SUCCEEDED", training.bq.model(training.context["candidate_model"]))
        metrics = training.execute("evaluate", training.template("evaluate_model.sql"))[0]
        baseline = training.execute(
            "baseline",
            f"""SELECT AVG(ABS(offset_f)) AS mean_absolute_error,
            AVG(POW(offset_f, 2)) AS mean_squared_error
            FROM `{training.context['feature_table']}` WHERE is_eval""",
        )[0]
        smoke = training.execute(
            "explain", training.template("explain_prediction.sql"),
            training.parameters + ("latitude:FLOAT64:33.749", "longitude:FLOAT64:-84.388"),
        )
        if (
            len(smoke) != 1 or not math.isfinite(float(smoke[0]["predicted_offset_f"]))
            or len(smoke[0]["top_feature_attributions"]) != 3
            or any(
                item["feature"] not in FEATURES or not math.isfinite(float(item["attribution"]))
                for item in smoke[0]["top_feature_attributions"]
            )
        ):
            raise ValueError("Tuned candidate explanation smoke test failed.")
        for key in ("mean_absolute_error", "mean_squared_error", "r2_score"):
            if not math.isfinite(float(metrics[key])):
                raise ValueError(f"Invalid outer metric: {key}")
        if training.bq.model(active_name)["etag"] != active_before["etag"]:
            raise RuntimeError("Active model changed during tuning; inspect concurrent updates.")
        summary = {
            "run_id": training.identifier, "parent_run": parent_run, **training.context,
            **selection, "metrics": metrics, "parent_metrics": parent["metrics"],
            "zero_offset_baseline": baseline,
            "quality_warnings": quality_warnings(metrics, baseline),
            "outer_holdout_previously_inspected": True,
            "active_model_unchanged": True, "promoted": False,
            "improved_both_errors": all(
                float(metrics[key]) < float(parent["metrics"][key])
                for key in ("mean_absolute_error", "mean_squared_error")
            ),
        }
        training.event("run", "EXPERIMENT_COMPLETED", summary)
        return summary
    except (Exception, KeyboardInterrupt) as error:
        training.event("run", "FAILED", {
            "error_type": type(error).__name__, "error": str(error), "parent_run": parent_run,
            "artifacts_retained": training.context,
        })
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--parent-run", required=True)
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--dataset", default=os.environ.get("BQ_DATASET", "a4i_climate"))
    parser.add_argument("--location", default=os.environ.get("BQ_LOCATION", "US"))
    args = parser.parse_args()
    if not args.project:
        parser.error("Set GOOGLE_CLOUD_PROJECT or pass --project.")
    validate_namespace(args.project, args.dataset, args.location)
    if not args.execute:
        print(json.dumps({"mode": "plan_only", "parent_run": args.parent_run,
                          "regularization": REGULARIZATION, "folds": FOLDS, "promoted": False}))
        return
    training = TrainingRun(BigQuery(args.project, args.location, run_id(), 1_000_000_000), args.dataset)
    print(json.dumps(tune(training, args.parent_run), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
