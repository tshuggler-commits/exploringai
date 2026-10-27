"""Promote a validated BQML candidate to the active model, or rollback to a prior backup."""

import argparse
from datetime import datetime, timezone
import json
import math
import os
import re
from typing import Any

from .train_candidate import (
    BigQuery, FEATURES, TrainingRun, code_manifest, run_id, validate_namespace,
)


def get_candidate_event(training: TrainingRun, candidate_run: str) -> dict[str, Any]:
    if not re.fullmatch(r"[0-9]{8}_[0-9]{6}_[a-f0-9]{12}", candidate_run):
        raise ValueError("Invalid candidate run ID.")
    rows = training.bq.query(
        f"""SELECT stage, state, payload FROM `{training.events}`
        WHERE run_id=@run AND stage='run'
          AND state IN ('VALIDATED_CANDIDATE', 'EXPERIMENT_COMPLETED', 'BUFFER_AUDIT_COMPLETED')
        ORDER BY event_time DESC LIMIT 1""",
        "candidate_lookup", (f"run:STRING:{candidate_run}",),
    )
    if not rows:
        raise ValueError(
            f"Candidate run {candidate_run} must be a completed and validated experiment or audit."
        )
    payload = rows[0]["payload"]
    parsed = json.loads(payload) if isinstance(payload, str) else payload
    parsed["state"] = rows[0]["state"]
    return parsed


def smoke_test_explanation(training: TrainingRun, model_name: str) -> list[dict[str, Any]]:
    training.context["tract_source"] = f"{training.namespace}.tract_demographics"
    smoke = training.execute(
        "smoke_explain", training.template("explain_prediction.sql").replace(
            f"`{training.context['candidate_model']}`", f"`{model_name}`"
        ),
        training.parameters + ("latitude:FLOAT64:33.749", "longitude:FLOAT64:-84.388"),
    )
    if (
        len(smoke) != 1
        or not math.isfinite(float(smoke[0]["predicted_offset_f"]))
        or len(smoke[0]["top_feature_attributions"]) != 3
        or any(
            item["feature"] not in FEATURES or not math.isfinite(float(item["attribution"]))
            for item in smoke[0]["top_feature_attributions"]
        )
    ):
        raise ValueError(f"Model {model_name} failed explanation verification.")
    return smoke


def promote(training: TrainingRun, candidate_run: str) -> dict[str, Any]:
    candidate = get_candidate_event(training, candidate_run)
    candidate_model = candidate.get("candidate_model")
    if not candidate_model:
        raise ValueError("Candidate run payload does not contain candidate_model.")

    # Verify candidate model resource exists in BigQuery
    candidate_meta = training.bq.model(candidate_model)

    active_name = f"{training.namespace}.heat_offset_model"
    active_before = training.bq.model(active_name)

    backup_name = f"{training.namespace}.heat_offset_model_backup_{training.identifier}"

    manifest = code_manifest()
    training.event("promotion", "STARTED", {
        **manifest, "candidate_run": candidate_run, "candidate_model": candidate_model,
        "active_model": active_name, "backup_model": backup_name,
        "active_etag_before": active_before.get("etag"),
        "candidate_etag": candidate_meta.get("etag"),
        "reference_time": training.reference_time,
    })

    try:
        # Step 1: Backup active model
        training.bq.copy_model(active_name, backup_name)
        backup_meta = training.bq.model(backup_name)

        # Step 2: Promote candidate model to active model
        training.bq.copy_model(candidate_model, active_name, force=True)
        active_after = training.bq.model(active_name)

        # Step 3: Run inference verification smoke test on new active model
        smoke = smoke_test_explanation(training, active_name)

        summary = {
            "run_id": training.identifier,
            "action": "PROMOTE",
            "candidate_run": candidate_run,
            "candidate_model": candidate_model,
            "candidate_state": candidate.get("state"),
            "active_model": active_name,
            "backup_model": backup_name,
            "previous_etag": active_before.get("etag"),
            "new_etag": active_after.get("etag"),
            "candidate_metrics": candidate.get("metrics"),
            "smoke_test": {
                "predicted_offset_f": float(smoke[0]["predicted_offset_f"]),
                "attributions_count": len(smoke[0]["top_feature_attributions"]),
            },
            "promoted": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        training.event("promotion", "PROMOTED", summary)
        return summary
    except (Exception, KeyboardInterrupt) as error:
        training.event("promotion", "FAILED", {
            "error_type": type(error).__name__, "error": str(error),
            "candidate_run": candidate_run, "backup_model": backup_name,
        })
        raise


def rollback(training: TrainingRun, backup_model: str) -> dict[str, Any]:
    if not re.fullmatch(r"[a-z0-9_-]+(\.[a-z0-9_-]+){2}", backup_model.lower()):
        raise ValueError("Invalid fully qualified backup model name.")

    backup_meta = training.bq.model(backup_model)
    active_name = f"{training.namespace}.heat_offset_model"
    active_before = training.bq.model(active_name)

    pre_rollback_backup = f"{training.namespace}.heat_offset_model_pre_rollback_{training.identifier}"

    manifest = code_manifest()
    training.event("rollback", "STARTED", {
        **manifest, "backup_model": backup_model, "active_model": active_name,
        "pre_rollback_backup": pre_rollback_backup,
        "active_etag_before": active_before.get("etag"),
        "reference_time": training.reference_time,
    })

    try:
        # Step 1: Backup current active before restoring
        training.bq.copy_model(active_name, pre_rollback_backup)

        # Step 2: Restore backup model to active model
        training.bq.copy_model(backup_model, active_name, force=True)
        active_after = training.bq.model(active_name)

        # Step 3: Smoke test restored active model
        smoke = smoke_test_explanation(training, active_name)

        summary = {
            "run_id": training.identifier,
            "action": "ROLLBACK",
            "restored_from": backup_model,
            "active_model": active_name,
            "pre_rollback_backup": pre_rollback_backup,
            "previous_etag": active_before.get("etag"),
            "new_etag": active_after.get("etag"),
            "smoke_test": {
                "predicted_offset_f": float(smoke[0]["predicted_offset_f"]),
                "attributions_count": len(smoke[0]["top_feature_attributions"]),
            },
            "rolled_back": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        training.event("rollback", "ROLLED_BACK", summary)
        return summary
    except (Exception, KeyboardInterrupt) as error:
        training.event("rollback", "FAILED", {
            "error_type": type(error).__name__, "error": str(error),
            "backup_model": backup_model,
        })
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--candidate-run", help="Run ID of the validated candidate to promote.")
    group.add_argument("--rollback", help="Fully qualified backup model name to restore.")
    parser.add_argument("--execute", action="store_true", help="Authorize active model promotion/rollback.")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--dataset", default=os.environ.get("BQ_DATASET", "a4i_climate"))
    parser.add_argument("--location", default=os.environ.get("BQ_LOCATION", "US"))
    parser.add_argument("--maximum-bytes-billed", type=int, default=1_000_000_000)
    args = parser.parse_args()

    if not args.project:
        parser.error("Set GOOGLE_CLOUD_PROJECT or pass --project.")
    validate_namespace(args.project, args.dataset, args.location)

    if not args.execute:
        plan = {
            "mode": "plan_only",
            "action": "ROLLBACK" if args.rollback else "PROMOTE",
            "target": args.rollback or args.candidate_run,
            "active_model": f"{args.project}.{args.dataset}.heat_offset_model",
            "promoted": False,
        }
        print(json.dumps(plan, indent=2))
        return

    training = TrainingRun(
        BigQuery(args.project, args.location, run_id(), args.maximum_bytes_billed), args.dataset,
    )
    if args.rollback:
        result = rollback(training, args.rollback)
    else:
        result = promote(training, args.candidate_run)
    print(json.dumps(result, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
