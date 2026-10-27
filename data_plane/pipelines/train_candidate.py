"""Train and audit a versioned BQML candidate without modifying the serving model."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
from typing import Any
import uuid


ROOT = Path(__file__).resolve().parents[2]
DATA_PLANE = ROOT / "data_plane"
FEATURES = (
    "latitude", "longitude", "median_income", "poverty_rate", "no_vehicle_rate",
    "median_age", "housing_units", "median_year_structure_built",
)
FILES = (
    "data_plane/pipelines/train_candidate.py", "data_plane/pipelines/tune_candidate.py",
    "data_plane/pipelines/audit_candidate.py", "data_plane/pipelines/promote_candidate.py",
    "data_plane/sql/clean_tracts.sql", "data_plane/sql/prepare_features.sql",
    "data_plane/sql/train_model.sql", "data_plane/sql/evaluate_model.sql",
    "data_plane/sql/explain_prediction.sql",
)


def render(sql: str, values: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values:
            raise ValueError(f"Missing SQL template value: {key}")
        return values[key]

    return re.sub(r"\{\{([a-z_]+)\}\}", replace, sql)


def validate_namespace(project: str, dataset: str, location: str) -> None:
    if not re.fullmatch(r"[a-z][a-z0-9-]{4,61}[a-z0-9]", project):
        raise ValueError("Invalid Google Cloud project ID.")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,1023}", dataset):
        raise ValueError("Invalid BigQuery dataset ID.")
    if not re.fullmatch(r"[A-Za-z0-9-]+", location):
        raise ValueError("Invalid BigQuery location.")


def run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:12]


def code_manifest() -> dict[str, Any]:
    sources = {name: (ROOT / name).read_text() for name in FILES}
    encoded = json.dumps(sources, sort_keys=True).encode()
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, check=True, text=True, capture_output=True,
    ).stdout.strip()
    status = subprocess.run(
        ["git", "status", "--porcelain"], cwd=ROOT, check=True, text=True, capture_output=True,
    ).stdout
    return {
        "git_commit": commit,
        "git_dirty": bool(status),
        "git_status": status,
        "code_sha256": hashlib.sha256(encoded).hexdigest(),
        "source_files": sources,
    }


def check_metrics(metrics: dict[str, Any], baseline_mae: float) -> None:
    for key in ("mean_absolute_error", "mean_squared_error", "r2_score"):
        if key not in metrics or not math.isfinite(float(metrics[key])):
            raise ValueError(f"Missing or non-finite evaluation metric: {key}")
    mae = float(metrics["mean_absolute_error"])
    mse = float(metrics["mean_squared_error"])
    if mae < 0 or mse < 0:
        raise ValueError("Negative evaluation error.")
    if mae > baseline_mae:
        raise ValueError(f"Candidate MAE {mae:.6f} exceeds zero-offset baseline {baseline_mae:.6f}.")
    if float(metrics["r2_score"]) >= 0.98:
        raise ValueError("Suspiciously high R2; review leakage before accepting the candidate.")


def quality_warnings(metrics: dict[str, Any], baseline: dict[str, Any]) -> list[str]:
    warnings = []
    if float(metrics["r2_score"]) < 0:
        warnings.append("Negative holdout R2: worse squared error than the holdout mean predictor.")
    if float(metrics["mean_squared_error"]) > float(baseline["mean_squared_error"]):
        warnings.append("Holdout MSE is worse than the zero-offset baseline; not promotion-ready.")
    return warnings


class BigQuery:
    def __init__(self, project: str, location: str, identifier: str, maximum_bytes: int):
        self.project = project
        self.location = location
        self.identifier = identifier
        self.maximum_bytes = maximum_bytes

    def query(
        self, sql: str, stage: str, parameters: tuple[str, ...] = (),
        job_id: str | None = None, fetch_rows: bool = True,
    ) -> list[dict[str, Any]]:
        job_id = job_id or f"a4i_{self.identifier}_{stage}_{uuid.uuid4().hex[:8]}"
        command = [
            "bq", f"--project_id={self.project}", f"--location={self.location}",
            "--format=json", f"--job_id={job_id}", "query", "--use_legacy_sql=false",
            f"--maximum_bytes_billed={self.maximum_bytes}", "--max_rows=100",
            f"--label=training_run:{self.identifier}",
        ]
        command.extend(f"--parameter={parameter}" for parameter in parameters)
        result = subprocess.run(command, input=sql, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError(
                f"BigQuery stage {stage}, job {job_id} failed:\n{result.stderr}\n{result.stdout}"
            )
        if not fetch_rows:
            return []
        return json.loads(result.stdout)

    def model(self, name: str) -> dict[str, Any]:
        project, resource = name.split(".", 1)
        result = subprocess.run(
            ["bq", f"--project_id={self.project}", f"--location={self.location}",
             "--format=json", "show", "--model", f"{project}:{resource}"],
            capture_output=True, text=True,
        )
        if result.returncode:
            raise RuntimeError(f"Cannot read model {name}:\n{result.stderr}\n{result.stdout}")
        return json.loads(result.stdout)

    def copy_model(self, source: str, destination: str, force: bool = False) -> None:
        src_proj, src_res = source.split(".", 1)
        dst_proj, dst_res = destination.split(".", 1)
        command = [
            "bq", f"--project_id={self.project}", f"--location={self.location}",
            "cp",
        ]
        if force:
            command.append("-f")
        command.extend([f"{src_proj}:{src_res}", f"{dst_proj}:{dst_res}"])
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(
                f"Cannot copy model {source} to {destination}:\n{result.stderr}\n{result.stdout}"
            )

    def job_statistics(self, identifier: str) -> dict[str, Any]:
        result = subprocess.run(
            ["bq", f"--project_id={self.project}", f"--location={self.location}",
             "--format=json", "show", "--job", f"{self.project}:{identifier}"],
            capture_output=True, text=True,
        )
        if result.returncode:
            raise RuntimeError(f"Cannot read job {identifier}:\n{result.stderr}\n{result.stdout}")
        job = json.loads(result.stdout)
        statistics = job["statistics"]
        query_stats = statistics.get("query", {})
        return {
            "job_reference": job["jobReference"], "status": job["status"],
            "statistics": {
                key: value for key, value in statistics.items() if key != "query"
            },
            "query_statistics": {
                key: query_stats[key] for key in (
                    "totalBytesProcessed", "totalBytesBilled", "totalSlotMs",
                    "cacheHit", "statementType", "mlStatistics",
                ) if key in query_stats
            },
        }


class TrainingRun:
    def __init__(self, bq: BigQuery, dataset: str):
        self.bq = bq
        self.namespace = f"{bq.project}.{dataset}"
        self.events = f"{self.namespace}.model_training_events"
        self.identifier = bq.identifier
        self.context = {
            "candidate_model": f"{self.namespace}.heat_offset_model_{self.identifier}",
            "feature_table": f"{self.namespace}.training_data_{self.identifier}",
            "heat_source": f"{self.namespace}.heat_snapshot_{self.identifier}",
            "tract_source": f"{self.namespace}.tract_snapshot_{self.identifier}",
        }
        self.reference_time = datetime.now(timezone.utc).isoformat()
        self.parameters = (f"reference_time:TIMESTAMP:{self.reference_time}",)

    def event(self, stage: str, state: str, payload: dict[str, Any]) -> None:
        self.bq.query(
            f"""INSERT INTO `{self.events}`
                (event_id, run_id, event_time, stage, state, candidate_model, payload)
                VALUES (@event_id, @run_id, CURRENT_TIMESTAMP(), @stage, @state,
                        @candidate, PARSE_JSON(@payload))""",
            "event",
            (
                f"event_id:STRING:{uuid.uuid4().hex}",
                f"run_id:STRING:{self.identifier}",
                f"stage:STRING:{stage}", f"state:STRING:{state}",
                f"candidate:STRING:{self.context['candidate_model']}",
                f"payload:STRING:{json.dumps(payload, allow_nan=False)}",
            ),
            fetch_rows=False,
        )

    def execute(
        self, stage: str, sql: str, parameters: tuple[str, ...] = (),
        fetch_rows: bool = True,
    ) -> list[dict[str, Any]]:
        job_id = f"a4i_{self.identifier}_{stage}"
        self.event(stage, "SUBMITTED", {
            "job_id": job_id, "sql": sql, "sql_sha256": hashlib.sha256(sql.encode()).hexdigest(),
            "parameters": parameters,
        })
        print(f"{stage}: {job_id}", flush=True)
        rows = self.bq.query(sql, stage, parameters, job_id, fetch_rows=fetch_rows)
        self.event(stage, "SUCCEEDED", {
            "job_id": job_id, "result": rows,
            "job_metadata": self.bq.job_statistics(job_id),
        })
        return rows

    def template(self, filename: str) -> str:
        values = dict(self.context)
        values["clean_tracts_sql"] = render(
            (DATA_PLANE / "sql/clean_tracts.sql").read_text(), values,
        )
        return render((DATA_PLANE / "sql" / filename).read_text(), values)

    def run(self) -> dict[str, Any]:
        manifest = code_manifest()
        active_name = f"{self.namespace}.heat_offset_model"
        active_before = self.bq.model(active_name)
        self.bq.query(
            f"""CREATE TABLE IF NOT EXISTS `{self.events}` (
              event_id STRING NOT NULL, run_id STRING NOT NULL, event_time TIMESTAMP NOT NULL,
              stage STRING NOT NULL, state STRING NOT NULL, candidate_model STRING NOT NULL,
              payload JSON
            ) PARTITION BY DATE(event_time) CLUSTER BY run_id, stage
            OPTIONS (description = 'Append-only BQML candidate training audit events')""",
            "registry",
            fetch_rows=False,
        )
        self.event("run", "STARTED", {
            **manifest, **self.context, "reference_time": self.reference_time,
            "location": self.bq.location, "maximum_bytes_billed": self.bq.maximum_bytes,
            "active_model_before": active_before,
            "split": "0.02-degree grid, normalized FARM_FINGERPRINT mod 5 = 0 held out",
            "target": "temp_f minus training-only mean; holdout temperatures never set the anchor",
            "limitations": [
                "Nearest tract centroid, not polygon containment; no distance cutoff.",
                "Spatial grid split has no buffer; neighboring cells can remain correlated.",
                "One campaign; no temporal generalization claim.",
                "Socioeconomic attributions are associations, not causal intervention effects.",
                "Legacy active model has contaminated income; not a valid unbiased benchmark.",
            ],
        })
        try:
            # One fixed timestamp keeps the two source snapshots consistent in time.
            for kind, source in (
                ("heat_source", "heat_observations"), ("tract_source", "tract_demographics"),
            ):
                self.execute(
                    f"snapshot_{source}",
                    f"""CREATE SNAPSHOT TABLE `{self.context[kind]}`
                        CLONE `{self.namespace}.{source}`
                        FOR SYSTEM_TIME AS OF @reference_time""",
                    self.parameters,
                    fetch_rows=False,
                )
            source_stats = self.execute(
                "source_checks",
                f"""SELECT
                  (SELECT COUNT(*) FROM `{self.context['heat_source']}`) AS heat_rows,
                  (SELECT COUNTIF(city IS NULL OR TRIM(city) = '')
                   FROM `{self.context['heat_source']}`) AS missing_city_labels,
                  (SELECT COUNT(*) FROM `{self.context['tract_source']}`) AS tract_rows,
                  (SELECT COUNT(*) FROM `{self.namespace}.station_daily_temps`) AS station_rows,
                  (SELECT COUNT(*) FROM `{self.namespace}.atlanta_daily_weather_clean`) AS weather_rows""",
            )[0]
            if any(int(source_stats[key]) <= 0 for key in (
                "heat_rows", "tract_rows", "station_rows", "weather_rows",
            )):
                raise ValueError("A required source table is empty.")
            if int(source_stats["missing_city_labels"]):
                print("WARNING: missing source city labels retained in snapshot; Atlanta-only scope.", flush=True)
            self.execute("features", self.template("prepare_features.sql"), self.parameters, fetch_rows=False)
            stats = self.execute(
                "feature_checks",
                f"""SELECT COUNT(*) AS row_count,
                  COUNT(DISTINCT observation_id) AS unique_observations,
                  COUNTIF(is_eval) AS eval_rows, COUNTIF(NOT is_eval) AS train_rows,
                  COUNTIF(income_imputed) AS income_imputed_rows,
                  MIN(median_income) AS min_income, MAX(median_income) AS max_income,
                  MAX(tract_distance_m) AS max_tract_distance_m,
                  ANY_VALUE(training_mean_temp_f) AS training_mean_temp_f,
                  AVG(temp_f) AS full_campaign_mean_temp_f,
                  COUNTIF(EXISTS (
                    SELECT 1 FROM UNNEST([
                      offset_f, latitude, longitude, median_income, poverty_rate, no_vehicle_rate,
                      median_age, housing_units, median_year_structure_built
                    ]) AS value WHERE value IS NULL OR IS_NAN(value) OR IS_INF(value)
                  ) OR median_income < 0) AS invalid_rows,
                  (SELECT COUNT(*) FROM (
                    SELECT spatial_cell FROM `{self.context['feature_table']}`
                    GROUP BY spatial_cell HAVING COUNT(DISTINCT is_eval) > 1
                  )) AS overlapping_cells
                FROM `{self.context['feature_table']}`""",
            )[0]
            if (
                int(stats["row_count"]) != int(source_stats["heat_rows"])
                or int(stats["row_count"]) != int(stats["unique_observations"])
                or int(stats["train_rows"]) == 0 or int(stats["eval_rows"]) == 0
                or int(stats["invalid_rows"]) != 0 or int(stats["overlapping_cells"]) != 0
            ):
                raise ValueError(f"Training feature checks failed: {stats}")
            self.execute("train", self.template("train_model.sql"), fetch_rows=False)
            self.event("model_metadata", "SUCCEEDED", self.bq.model(self.context["candidate_model"]))
            info = self.execute(
                "feature_info",
                f"SELECT * FROM ML.FEATURE_INFO(MODEL `{self.context['candidate_model']}`)",
            )
            if {row["input"] for row in info} != set(FEATURES):
                raise ValueError("Candidate model input features do not match the agent contract.")
            income = next(row for row in info if row["input"] == "median_income")
            if float(income["min"]) < 0 or int(income["null_count"]) != 0:
                raise ValueError("Model training retained invalid income values.")
            metrics = self.execute("evaluate", self.template("evaluate_model.sql"))[0]
            baseline = self.execute(
                "baseline",
                f"""SELECT AVG(ABS(offset_f)) AS mean_absolute_error,
                  AVG(POW(offset_f, 2)) AS mean_squared_error
                FROM `{self.context['feature_table']}` WHERE is_eval""",
            )[0]
            point = self.execute(
                "smoke_input",
                f"""SELECT latitude, longitude FROM `{self.context['feature_table']}`
                WHERE is_eval ORDER BY observation_id LIMIT 1""",
            )[0]
            smoke = self.execute(
                "explain", self.template("explain_prediction.sql"),
                self.parameters + (
                    f"latitude:FLOAT64:{point['latitude']}",
                    f"longitude:FLOAT64:{point['longitude']}",
                ),
            )
            if (
                len(smoke) != 1
                or not math.isfinite(float(smoke[0]["predicted_offset_f"]))
                or len(smoke[0]["top_feature_attributions"]) != 3
                or any(
                    item["feature"] not in FEATURES
                    or not math.isfinite(float(item["attribution"]))
                    for item in smoke[0]["top_feature_attributions"]
                )
            ):
                raise ValueError("ML.EXPLAIN_PREDICT returned an invalid response.")
            active_after = self.bq.model(active_name)
            if active_before["etag"] != active_after["etag"]:
                raise RuntimeError("Active model changed during the run; investigate concurrent updates.")
            check_metrics(metrics, float(baseline["mean_absolute_error"]))
            summary = {
                "run_id": self.identifier, **self.context,
                "feature_stats": stats, "metrics": metrics, "zero_offset_baseline": baseline,
                "quality_warnings": quality_warnings(metrics, baseline),
                "active_model_unchanged": True, "promoted": False,
                "promotion_review_required": True,
            }
            self.event("run", "VALIDATED_CANDIDATE", summary)
            return summary
        except (Exception, KeyboardInterrupt) as error:
            self.event("run", "FAILED", {
                "error_type": type(error).__name__, "error": str(error),
                "artifacts_retained": self.context,
                "note": "Submitted jobs may still run after interruption; inspect recorded job IDs.",
            })
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Authorize candidate-only BigQuery writes.")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--dataset", default=os.environ.get("BQ_DATASET", "a4i_climate"))
    parser.add_argument("--location", default=os.environ.get("BQ_LOCATION", "US"))
    parser.add_argument("--maximum-bytes-billed", type=int, default=1_000_000_000)
    args = parser.parse_args()
    if not args.project:
        parser.error("Set GOOGLE_CLOUD_PROJECT or pass --project.")
    validate_namespace(args.project, args.dataset, args.location)
    if args.maximum_bytes_billed <= 0:
        parser.error("--maximum-bytes-billed must be positive.")
    training = TrainingRun(
        BigQuery(args.project, args.location, run_id(), args.maximum_bytes_billed), args.dataset,
    )
    if not args.execute:
        print(json.dumps({"mode": "plan_only", **training.context}, indent=2))
        return
    print(json.dumps(training.run(), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
