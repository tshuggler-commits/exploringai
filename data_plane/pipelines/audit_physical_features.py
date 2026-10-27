"""Read-only canopy quality/coverage audit; never train, promote, or infer provenance."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from typing import Any

from .train_candidate import BigQuery, DATA_PLANE, render, run_id, validate_namespace


def audit_sql(namespace: str, feature_run: str) -> str:
    if not re.fullmatch(r"[0-9]{8}_[0-9]{6}_[a-f0-9]{12}", feature_run):
        raise ValueError("Invalid feature run ID.")
    project, dataset = namespace.split(".", 1)
    validate_namespace(project, dataset, "US")
    return render((DATA_PLANE / "sql" / "audit_physical_features.sql").read_text(), {
        "namespace": namespace,
        "feature_table": f"{namespace}.training_data_{feature_run}",
    })


def audit(bq: BigQuery, dataset: str, feature_run: str) -> dict[str, Any]:
    namespace = f"{bq.project}.{dataset}"
    sql = audit_sql(namespace, feature_run)
    job_id = f"a4i_{bq.identifier}_physical_features"
    rows = bq.query(sql, "physical_features", job_id=job_id)
    if len(rows) != 1:
        raise ValueError(f"Expected one physical-feature audit row, received {len(rows)}.")
    return {
        "audit_id": bq.identifier,
        "mode": "read_only_audit",
        "source_table": f"{namespace}.atlanta_canopy_heat_svi_modeling",
        "feature_table": f"{namespace}.training_data_{feature_run}",
        "sql_sha256": hashlib.sha256(sql.encode()).hexdigest(),
        "executed_sql": sql,
        "job": bq.job_statistics(job_id),
        "evidence": rows[0],
        "feature_admission": "BLOCKED_PENDING_PROVENANCE_AND_COVERAGE_REVIEW",
        "missing_source_contract": [
            "Publisher and source URL or asset identifier",
            "License and permitted uses",
            "Observation vintage and temporal relationship to the heat campaign",
            "Confirmed units and canopy measurement methodology",
            "Tract boundary vintage, aggregation and GEOID crosswalk methodology",
            "Reproducible extraction/transformation and original input checksums",
        ],
        "limitations": [
            "Value range alone does not establish percent units; no rescaling is performed.",
            "Sources are read as of this query, not retained as immutable snapshots.",
            "Observation coverage is weighted by campaign sampling, not land area or population.",
            "Ranking eligibility mirrors the current agent filter, not validated geographic support.",
            "No missing canopy values are imputed and no rows are admitted to a model.",
            "No model was trained, evaluated for acceptance, or promoted by this audit.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Execute read-only BigQuery queries.")
    parser.add_argument("--feature-run", required=True, help="Original training_data run ID.")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--dataset", default=os.environ.get("BQ_DATASET", "a4i_climate"))
    parser.add_argument("--location", default=os.environ.get("BQ_LOCATION", "US"))
    parser.add_argument("--output", type=Path, help="Create a new local JSON report; never overwrite.")
    args = parser.parse_args()
    if not args.project:
        parser.error("Set GOOGLE_CLOUD_PROJECT or pass --project.")
    validate_namespace(args.project, args.dataset, args.location)
    sql = audit_sql(f"{args.project}.{args.dataset}", args.feature_run)
    if not args.execute:
        print(json.dumps({"mode": "plan_only", "sql": sql, "writes_to_bigquery": False}, indent=2))
        return
    if args.output and args.output.exists():
        parser.error("--output must refer to a new file.")
    result = audit(BigQuery(args.project, args.location, run_id(), 1_000_000_000),
                   args.dataset, args.feature_run)
    document = json.dumps(result, indent=2, allow_nan=False) + "\n"
    if args.output:
        with args.output.open("x") as output:
            output.write(document)
    print(document, end="")


if __name__ == "__main__":
    main()
