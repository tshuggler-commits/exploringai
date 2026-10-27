"""Audit tract heat rankings and leave-one-cell-out sensitivity without fitting models."""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
from typing import Any

from .train_candidate import BigQuery, FEATURES, run_id, validate_namespace


MIN_READINGS = 30
MIN_TRACTS = 10
TOP_K = 5
COMPLETED = ("VALIDATED_CANDIDATE", "EXPERIMENT_COMPLETED", "BUFFER_AUDIT_COMPLETED")


def validate_run(value: str) -> None:
    if not re.fullmatch(r"[0-9]{8}_[0-9]{6}_[a-f0-9]{12}", value):
        raise ValueError(f"Invalid run ID: {value}")


def candidate(bq: BigQuery, namespace: str, identifier: str, source_run: str) -> dict[str, str]:
    """Require a completed, same-source lineage instead of trusting arbitrary model names."""
    seen = set()
    current = identifier
    result = None
    while True:
        validate_run(current)
        if current in seen:
            raise ValueError("Cycle in candidate lineage.")
        seen.add(current)
        rows = bq.query(
            f"""SELECT candidate_model, payload FROM `{namespace}.model_training_events`
            WHERE run_id=@run AND stage='run'
              AND state IN UNNEST(@states)
            ORDER BY event_time DESC LIMIT 1""",
            "ranking_lineage",
            (f"run:STRING:{current}", f"states:ARRAY<STRING>:{json.dumps(COMPLETED)}"),
        )
        if len(rows) != 1:
            raise ValueError(f"No completed candidate event for {current}.")
        payload = rows[0]["payload"]
        event = json.loads(payload) if isinstance(payload, str) else payload
        expected = f"{namespace}.heat_offset_model_{current}"
        if rows[0]["candidate_model"] != expected:
            raise ValueError("Candidate model does not match run lineage.")
        if result is None:
            feature_table = event["feature_table"]
            if feature_table not in (
                f"{namespace}.{prefix}_{current}"
                for prefix in ("training_data", "tuning_features", "buffered_features")
            ):
                raise ValueError("Unexpected candidate feature table.")
            result = {"run": identifier, "model": expected, "features": feature_table}
        if current == source_run:
            return result
        if "parent_run" not in event:
            raise ValueError("Candidate is not descended from the requested evaluation source.")
        current = event["parent_run"]


def ranking_sql(namespace: str, source_run: str, models: list[dict[str, str]]) -> str:
    validate_run(source_run)
    project, dataset = namespace.split(".", 1)
    validate_namespace(project, dataset, "US")
    predictions = []
    for model in models:
        validate_run(model["run"])
        if model["model"] != f"{namespace}.heat_offset_model_{model['run']}":
            raise ValueError("Unexpected model resource.")
        if model["features"] not in (
            f"{namespace}.{prefix}_{model['run']}"
            for prefix in ("training_data", "tuning_features", "buffered_features")
        ):
            raise ValueError("Unexpected feature resource.")
        predictions.append(f"""
          SELECT '{model['run']}' AS candidate_run, p.observation_id,
            p.predicted_offset_f + a.anchor - e.training_mean_temp_f AS prediction,
            a.anchors, a.invalid_anchors
          FROM ML.PREDICT(MODEL `{model['model']}`, (
            SELECT observation_id, {', '.join(FEATURES)} FROM evaluation
          )) AS p
          JOIN evaluation AS e USING(observation_id)
          CROSS JOIN (
            SELECT MIN(training_mean_temp_f) AS anchor,
              COUNT(DISTINCT training_mean_temp_f) AS anchors,
              COUNTIF(training_mean_temp_f IS NULL OR IS_NAN(training_mean_temp_f)
                OR IS_INF(training_mean_temp_f)) AS invalid_anchors
            FROM `{model['features']}`
          ) AS a""")
    if not predictions:
        raise ValueError("At least one candidate is required.")
    return f"""
    WITH evaluation AS (
      SELECT * FROM `{namespace}.training_data_{source_run}` WHERE is_eval
    ), predictions AS ({' UNION ALL '.join(predictions)}),
    errors AS (
      SELECT p.*, e.geo_id, e.spatial_cell, e.offset_f AS observed,
        p.prediction - e.offset_f AS error_f
      FROM predictions AS p JOIN evaluation AS e USING(observation_id)
    ), grouped AS (
      SELECT candidate_run, geo_id, spatial_cell,
        COUNT(*) AS n, COUNT(DISTINCT spatial_cell) AS cells,
        SUM(observed) AS observed_sum, SUM(prediction) AS predicted_sum,
        SUM(ABS(error_f)) AS absolute_error_sum,
        SUM(POW(error_f, 2)) AS squared_error_sum, SUM(error_f) AS error_sum,
        SUM(ABS(observed)) AS baseline_absolute_sum,
        SUM(POW(observed, 2)) AS baseline_squared_sum,
        APPROX_QUANTILES(ABS(error_f), 100)[OFFSET(90)] AS p90_absolute_error_f
      FROM errors
      GROUP BY GROUPING SETS (
        (candidate_run, geo_id, spatial_cell), (candidate_run, geo_id)
      )
    )
    SELECT
      (SELECT AS STRUCT COUNT(*) AS n, COUNT(DISTINCT observation_id) AS unique_ids,
        COUNT(DISTINCT spatial_cell) AS cells,
        COUNTIF(geo_id IS NULL OR spatial_cell IS NULL OR offset_f IS NULL
          OR IS_NAN(offset_f) OR IS_INF(offset_f)) AS invalid_rows,
        COUNT(DISTINCT training_mean_temp_f) AS anchors,
        COUNTIF(training_mean_temp_f IS NULL OR IS_NAN(training_mean_temp_f)
          OR IS_INF(training_mean_temp_f)) AS invalid_anchors
       FROM evaluation) AS evaluation_checks,
      ARRAY(SELECT AS STRUCT candidate_run, COUNT(*) AS n,
        COUNT(DISTINCT observation_id) AS unique_ids,
        COUNTIF(prediction IS NULL OR IS_NAN(prediction) OR IS_INF(prediction)
          OR anchors != 1 OR invalid_anchors != 0) AS invalid_predictions
        FROM errors GROUP BY candidate_run ORDER BY candidate_run) AS prediction_checks,
      ARRAY(SELECT AS STRUCT * FROM grouped
        ORDER BY candidate_run, geo_id, spatial_cell) AS tract_groups
    """


def average_ranks(values: list[float]) -> list[float]:
    ordered = sorted(range(len(values)), key=values.__getitem__)
    ranks = [0.0] * len(values)
    start = 0
    while start < len(ordered):
        end = start + 1
        while end < len(ordered) and values[ordered[end]] == values[ordered[start]]:
            end += 1
        for index in ordered[start:end]:
            ranks[index] = (start + end - 1) / 2 + 1
        start = end
    return ranks


def spearman(observed: list[float], predicted: list[float]) -> float | None:
    x, y = average_ranks(observed), average_ranks(predicted)
    mx, my = sum(x) / len(x), sum(y) / len(y)
    denominator = math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
    if denominator == 0:
        return None
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / denominator


def summarize(groups: list[dict[str, Any]]) -> dict[str, Any]:
    supported = [g for g in groups if int(g["n"]) >= MIN_READINGS]
    tracts = []
    for g in sorted(groups, key=lambda g: g["geo_id"]):
        n = int(g["n"])
        tracts.append({
            "geo_id": g["geo_id"], "readings": n, "cells": int(g["cells"]),
            "eligible": n >= MIN_READINGS,
            "observed_offset_f": float(g["observed_sum"]) / n,
            "predicted_offset_f": float(g["predicted_sum"]) / n,
            "mae_f": float(g["absolute_error_sum"]) / n,
            "mse_f2": float(g["squared_error_sum"]) / n,
            "bias_f": float(g["error_sum"]) / n,
            "p90_absolute_error_f": (
                float(g["p90_absolute_error_f"]) if "p90_absolute_error_f" in g else None
            ),
        })
    result: dict[str, Any] = {
        "status": "DEVELOPMENT_EVIDENCE" if len(supported) >= MIN_TRACTS else "INCONCLUSIVE",
        "eligible_tracts": len(supported), "excluded_tracts": len(groups) - len(supported),
        "tracts": tracts, "ranking_metrics": None,
    }
    if len(supported) < MIN_TRACTS:
        result["reason"] = f"Fewer than {MIN_TRACTS} tracts with at least {MIN_READINGS} readings."
        return result
    eligible = [t for t in tracts if t["eligible"]]
    observed_order = sorted(eligible, key=lambda t: (-t["observed_offset_f"], t["geo_id"]))
    predicted_order = sorted(eligible, key=lambda t: (-t["predicted_offset_f"], t["geo_id"]))
    # Average ordinal relevance preserves measured ties instead of inventing heat differences.
    relevance = dict(zip(
        [t["geo_id"] for t in eligible],
        [r - 1 for r in average_ranks([t["observed_offset_f"] for t in eligible])],
    ))
    def dcg(order: list[dict[str, Any]]) -> float:
        return sum(relevance[t["geo_id"]] / math.log2(i + 2)
                   for i, t in enumerate(order[:TOP_K]))

    ideal = dcg(observed_order)
    correlation = spearman([t["observed_offset_f"] for t in eligible],
                           [t["predicted_offset_f"] for t in eligible])
    all_observed_tied = len(set(t["observed_offset_f"] for t in eligible)) == 1
    overlap = len({t["geo_id"] for t in observed_order[:TOP_K]}
                  & {t["geo_id"] for t in predicted_order[:TOP_K]})
    n = sum(int(g["n"]) for g in supported)
    result["ranking_metrics"] = {
        "spearman": correlation,
        "top5_overlap": None if all_observed_tied else overlap,
        "precision_at_5": None if all_observed_tied else overlap / TOP_K,
        "ndcg_at_5": dcg(predicted_order) / ideal if ideal and not all_observed_tied else None,
        "tract_mean_absolute_error_f": sum(
            abs(t["predicted_offset_f"] - t["observed_offset_f"]) for t in eligible
        ) / len(eligible),
        "observation_mae_f": sum(float(g["absolute_error_sum"]) for g in supported) / n,
        "observation_mse_f2": sum(float(g["squared_error_sum"]) for g in supported) / n,
        "baseline_mae_f": sum(float(g["baseline_absolute_sum"]) for g in supported) / n,
        "baseline_mse_f2": sum(float(g["baseline_squared_sum"]) for g in supported) / n,
        "observed_top5": [t["geo_id"] for t in observed_order[:TOP_K]],
        "predicted_top5": [t["geo_id"] for t in predicted_order[:TOP_K]],
    }
    if correlation is None:
        result["status"] = "INCONCLUSIVE"
        result["reason"] = "Constant observed or predicted tract means; rank correlation undefined."
    return result


ADDITIVE = ("observed_sum", "predicted_sum", "absolute_error_sum", "squared_error_sum",
            "error_sum", "baseline_absolute_sum", "baseline_squared_sum")


def sensitivity(groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cells = sorted({g["spatial_cell"] for g in groups if g["spatial_cell"] is not None})
    results = []
    for omitted in cells:
        retained: dict[str, dict[str, Any]] = {}
        for g in groups:
            if g["spatial_cell"] is None or g["spatial_cell"] == omitted:
                continue
            tract = retained.setdefault(g["geo_id"], {
                "geo_id": g["geo_id"], "n": 0, "cells": 0, **dict.fromkeys(ADDITIVE, 0.0),
            })
            tract["n"] += int(g["n"])
            tract["cells"] += 1
            for key in ADDITIVE:
                tract[key] += float(g[key])
        summary = summarize(list(retained.values()))
        summary.pop("tracts")
        results.append({"omitted_cell": omitted, **summary})
    return results


def audit(bq: BigQuery, dataset: str, source_run: str, candidate_runs: list[str]) -> dict[str, Any]:
    validate_run(source_run)
    if not candidate_runs or len(set(candidate_runs)) != len(candidate_runs):
        raise ValueError("Specify unique candidate runs.")
    namespace = f"{bq.project}.{dataset}"
    validate_namespace(bq.project, dataset, bq.location)
    models = [candidate(bq, namespace, r, source_run) for r in candidate_runs]
    before = {m["run"]: bq.model(m["model"]) for m in models}
    sql = ranking_sql(namespace, source_run, models)
    job_id = f"a4i_{bq.identifier}_ranking"
    rows = bq.query(sql, "ranking", job_id=job_id)
    if len(rows) != 1:
        raise ValueError("Expected one ranking audit result.")
    evidence = rows[0]
    checks = evidence["evaluation_checks"]
    n = int(checks["n"])
    if (n == 0 or int(checks["unique_ids"]) != n or int(checks["invalid_rows"])
            or int(checks["anchors"]) != 1 or int(checks["invalid_anchors"])):
        raise ValueError(f"Invalid evaluation cohort: {checks}")
    prediction_checks = evidence["prediction_checks"]
    if (len(prediction_checks) != len(models)
            or {c["candidate_run"] for c in prediction_checks} != set(candidate_runs)):
        raise ValueError("Incomplete candidate predictions.")
    for check in prediction_checks:
        if (int(check["n"]) != n or int(check["unique_ids"]) != n
                or int(check["invalid_predictions"])):
            raise ValueError(f"Invalid candidate predictions: {check}")
    summaries = {}
    for model in models:
        if bq.model(model["model"])["etag"] != before[model["run"]]["etag"]:
            raise RuntimeError("Candidate model changed during audit.")
        groups = [g for g in evidence["tract_groups"] if g["candidate_run"] == model["run"]]
        summaries[model["run"]] = {
            **summarize([g for g in groups if g["spatial_cell"] is None]),
            "leave_one_cell_out": sensitivity(groups),
        }
    return {
        "audit_id": bq.identifier, "mode": "read_only_development_audit",
        "source_run": source_run, "models": models, "model_metadata_before": before,
        "protocol": {"min_readings": MIN_READINGS, "min_tracts": MIN_TRACTS, "top_k": TOP_K},
        "evaluation_checks": checks, "prediction_checks": prediction_checks,
        "results": summaries, "executed_sql": sql,
        "sql_sha256": hashlib.sha256(sql.encode()).hexdigest(),
        "job": bq.job_statistics(job_id), "acceptance": "PENDING_NOT_A_RELEASE_GATE",
        "limitations": [
            "Previously inspected holdout: development evidence, not independent certification.",
            "All predictions use the same original holdout and its labels; model anchors are aligned.",
            "Tracts are nearest-centroid assignments, not polygon containment.",
            "Ranks average predictions at observed points, not predictions at serving centroids.",
            "Leave-one-cell-out removes evaluation data only; models are not refitted.",
            "Sensitivity is not cross-validation or a confidence interval; support may change.",
            "P90 is approximate and per tract only; omitted-cell summaries do not report p90.",
            "No policy/vulnerability ranking or out-of-coverage tract is validated here.",
            "Draft thresholds have no approval; this audit cannot authorize promotion.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--source-run", required=True)
    parser.add_argument("--candidate-run", action="append", required=True)
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--dataset", default=os.environ.get("BQ_DATASET", "a4i_climate"))
    parser.add_argument("--location", default=os.environ.get("BQ_LOCATION", "US"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not args.project:
        parser.error("Set GOOGLE_CLOUD_PROJECT or pass --project.")
    validate_namespace(args.project, args.dataset, args.location)
    for identifier in [args.source_run, *args.candidate_run]:
        validate_run(identifier)
    if len(set(args.candidate_run)) != len(args.candidate_run):
        parser.error("Candidate runs must be unique.")
    if not args.execute:
        print(json.dumps({"mode": "plan_only", "source_run": args.source_run,
                          "candidate_runs": args.candidate_run, "writes_to_bigquery": False}))
        return
    if args.output and args.output.exists():
        parser.error("--output must refer to a new file.")
    result = audit(BigQuery(args.project, args.location, run_id(), 1_000_000_000),
                   args.dataset, args.source_run, args.candidate_run)
    document = json.dumps(result, indent=2, allow_nan=False) + "\n"
    if args.output:
        with args.output.open("x") as output:
            output.write(document)
    print(document, end="")


if __name__ == "__main__":
    main()
