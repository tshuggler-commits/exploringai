"""Audit residuals and refit a fixed candidate with a 500 m spatial exclusion buffer."""

import argparse
import json
import math
import os
import re
from typing import Any

from .train_candidate import (
    BigQuery, FEATURES, TrainingRun, code_manifest, quality_warnings, run_id, validate_namespace,
)


BUFFER_METERS = 500
COLUMNS = ", ".join(FEATURES)


def buffered_features_sql(source: str, destination: str) -> str:
    return f"""CREATE TABLE `{destination}` AS
    WITH excluded AS (
      SELECT DISTINCT fitting.observation_id
      FROM `{source}` AS fitting
      JOIN `{source}` AS held_out ON ST_DWITHIN(
        ST_GEOGPOINT(fitting.longitude, fitting.latitude),
        ST_GEOGPOINT(held_out.longitude, held_out.latitude), {BUFFER_METERS}
      )
      WHERE NOT fitting.is_eval AND held_out.is_eval
    ),
    retained AS (
      SELECT * EXCEPT(offset_f, training_mean_temp_f)
      FROM `{source}`
      WHERE is_eval OR observation_id NOT IN (SELECT observation_id FROM excluded)
    ),
    anchored AS (
      SELECT *, AVG(IF(NOT is_eval, temp_f, NULL)) OVER () AS training_mean_temp_f
      FROM retained
    )
    SELECT *, temp_f - training_mean_temp_f AS offset_f FROM anchored"""


def residuals_sql(model: str, features: str, destination: str) -> str:
    return f"""CREATE TABLE `{destination}` AS
    SELECT data.*, prediction.predicted_offset_f,
      prediction.predicted_offset_f - data.offset_f AS error_f
    FROM ML.PREDICT(MODEL `{model}`, (
      SELECT observation_id, {COLUMNS} FROM `{features}` WHERE is_eval
    )) AS prediction
    JOIN `{features}` AS data USING (observation_id)"""


def diagnostics_sql(residuals: str) -> str:
    return f"""SELECT dimension, category, COUNT(*) AS row_count,
      COUNT(DISTINCT geo_id) AS tract_count,
      AVG(ABS(error_f)) AS mae_f, AVG(POW(error_f, 2)) AS mse,
      AVG(error_f) AS bias_f,
      APPROX_QUANTILES(ABS(error_f), 100)[OFFSET(90)] AS p90_absolute_error_f,
      AVG(ABS(offset_f)) AS zero_offset_mae_f
    FROM `{residuals}`
    CROSS JOIN UNNEST([
      STRUCT('overall' AS dimension, 'all' AS category),
      STRUCT('income_imputation', IF(income_imputed, 'imputed', 'observed')),
      STRUCT('poverty_rate', IF(poverty_rate >= 0.20, 'at_least_20pct', 'below_20pct')),
      STRUCT('no_vehicle_rate', IF(no_vehicle_rate >= 0.20, 'at_least_20pct', 'below_20pct')),
      STRUCT('tract_distance', IF(tract_distance_m > 1500, 'over_1500m', 'within_1500m')),
      STRUCT('spatial_cell', spatial_cell)
    ])
    GROUP BY dimension, category HAVING COUNT(*) >= 30
    ORDER BY dimension, mae_f DESC"""


def audit(training: TrainingRun, parent_run: str) -> dict[str, Any]:
    if not re.fullmatch(r"[0-9]{8}_[0-9]{6}_[a-f0-9]{12}", parent_run):
        raise ValueError("Invalid parent run ID.")
    rows = training.bq.query(
        f"""SELECT payload FROM `{training.events}` WHERE run_id=@parent
        AND stage='run' AND state='EXPERIMENT_COMPLETED' ORDER BY event_time DESC LIMIT 1""",
        "parent", (f"parent:STRING:{parent_run}",),
    )
    if len(rows) != 1:
        raise ValueError("Parent must be a completed tuning experiment.")
    raw = rows[0]["payload"]
    parent = json.loads(raw) if isinstance(raw, str) else raw
    for key, prefix in (
        ("feature_table", "tuning_features_"),
        ("candidate_model", "heat_offset_model_"),
    ):
        if parent[key] != f"{training.namespace}.{prefix}{parent_run}":
            raise ValueError(f"Unexpected parent resource: {key}")
    l2 = parent["selected_l2"]
    if type(l2) is not int or l2 not in (0, 1000, 10000):
        raise ValueError("Unsupported parent regularization.")
    original = f"{training.namespace}.audit_source_{training.identifier}"
    training.context["feature_table"] = f"{training.namespace}.buffered_features_{training.identifier}"
    # Older events can carry a source-lineage correction; derive the known snapshot lineage.
    source_run = parent["parent_run"]
    if not re.fullmatch(r"[0-9]{8}_[0-9]{6}_[a-f0-9]{12}", source_run):
        raise ValueError("Invalid source lineage.")
    training.context["heat_source"] = f"{training.namespace}.heat_snapshot_{source_run}"
    training.context["tract_source"] = f"{training.namespace}.tract_snapshot_{source_run}"
    active = f"{training.namespace}.heat_offset_model"
    active_before = training.bq.model(active)
    training.event("run", "STARTED", {
        **code_manifest(), "parent_run": parent_run, **training.context,
        "buffer_meters": BUFFER_METERS, "fixed_l2": l2,
        "reference_time": training.reference_time,
        "purpose": "Spatial stress test and error audit, not hyperparameter selection.",
        "outer_holdout_previously_inspected": True,
        "slice_limitations": "Poverty/vehicle slices use cleaned values, including imputations.",
    })
    try:
        training.execute(
            "source_snapshot",
            f"""CREATE SNAPSHOT TABLE `{original}` CLONE `{parent['feature_table']}`
            FOR SYSTEM_TIME AS OF @reference_time""",
            training.parameters, fetch_rows=False,
        )
        diagnostics = {}
        for label, model, features in (
            ("parent", parent["candidate_model"], original),
            ("buffered", training.context["candidate_model"], training.context["feature_table"]),
        ):
            if label == "buffered":
                training.execute(
                    "buffer_features", buffered_features_sql(original, features), fetch_rows=False,
                )
                stats = training.execute(
                    "buffer_checks",
                    f"""SELECT COUNTIF(NOT is_eval) AS train_rows,
                      COUNTIF(is_eval) AS eval_rows,
                      (SELECT COUNTIF(is_eval) FROM `{original}`) AS original_eval_rows,
                      (SELECT COUNTIF(NOT is_eval) FROM `{original}`) AS original_train_rows,
                      (SELECT COUNT(*) FROM `{features}` AS fitting
                        JOIN `{features}` AS held_out ON ST_DWITHIN(
                          ST_GEOGPOINT(fitting.longitude, fitting.latitude),
                          ST_GEOGPOINT(held_out.longitude, held_out.latitude), {BUFFER_METERS}
                        ) WHERE NOT fitting.is_eval AND held_out.is_eval) AS buffer_violations,
                      COUNTIF(offset_f IS NULL OR IS_NAN(offset_f) OR IS_INF(offset_f)) AS invalid_labels
                    FROM `{features}`""",
                )[0]
                if (
                    int(stats["train_rows"]) < 1000
                    or int(stats["eval_rows"]) != int(stats["original_eval_rows"])
                    or int(stats["buffer_violations"]) != 0
                    or int(stats["invalid_labels"]) != 0
                ):
                    raise ValueError(f"Buffered split checks failed: {stats}")
                training.execute(
                    "train",
                    training.template("train_model.sql").replace(
                        "ENABLE_GLOBAL_EXPLAIN = TRUE",
                        f"L2_REG = {l2}, ENABLE_GLOBAL_EXPLAIN = TRUE",
                    ),
                    fetch_rows=False,
                )
                training.event("model_metadata", "SUCCEEDED", training.bq.model(model))
            destination = f"{training.namespace}.residuals_{label}_{training.identifier}"
            training.execute(
                f"residuals_{label}", residuals_sql(model, features, destination), fetch_rows=False,
            )
            residual_stats = training.execute(
                f"residual_checks_{label}",
                f"""SELECT COUNT(*) AS row_count,
                  COUNT(DISTINCT observation_id) AS unique_observations,
                  COUNTIF(error_f IS NULL OR IS_NAN(error_f) OR IS_INF(error_f)) AS invalid_errors,
                  (SELECT COUNTIF(is_eval) FROM `{features}`) AS expected_rows
                FROM `{destination}`""",
            )[0]
            if (
                int(residual_stats["row_count"]) != int(residual_stats["expected_rows"])
                or int(residual_stats["row_count"]) != int(residual_stats["unique_observations"])
                or int(residual_stats["invalid_errors"]) != 0
            ):
                raise ValueError(f"Incomplete or invalid {label} residuals: {residual_stats}")
            diagnostics[label] = training.execute(f"diagnostics_{label}", diagnostics_sql(destination))
        metrics = training.execute("evaluate", training.template("evaluate_model.sql"))[0]
        baseline = training.execute(
            "baseline",
            f"""SELECT AVG(ABS(offset_f)) AS mean_absolute_error,
            AVG(POW(offset_f, 2)) AS mean_squared_error
            FROM `{training.context['feature_table']}` WHERE is_eval""",
        )[0]
        for key in ("mean_absolute_error", "mean_squared_error", "r2_score"):
            if not math.isfinite(float(metrics[key])):
                raise ValueError(f"Invalid metric: {key}")
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
            raise ValueError("Buffered candidate explanation failed.")
        if training.bq.model(active)["etag"] != active_before["etag"]:
            raise RuntimeError("Active model changed during audit; inspect concurrent updates.")
        summary = {
            "run_id": training.identifier, "parent_run": parent_run, **training.context,
            "buffer_meters": BUFFER_METERS, "fixed_l2": l2, "split_stats": stats,
            "metrics": metrics, "parent_metrics": parent["metrics"],
            "zero_offset_baseline": baseline,
            "quality_warnings": quality_warnings(metrics, baseline),
            "diagnostics": diagnostics, "promoted": False, "active_model_unchanged": True,
            "note": "Stress test changes fitting rows and target anchor; not a new independent test.",
            "interpretation_warnings": [
                "Positive R2 can still represent weak predictive power; inspect spatial error slices.",
                "This campaign and previously inspected holdout cannot certify future-day performance.",
                "No automatic promotion or causal interpretation of demographic attributions.",
            ],
        }
        training.event("run", "BUFFER_AUDIT_COMPLETED", summary)
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
                          "buffer_meters": BUFFER_METERS, "promoted": False}))
        return
    training = TrainingRun(BigQuery(args.project, args.location, run_id(), 1_000_000_000), args.dataset)
    print(json.dumps(audit(training, args.parent_run), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
