"""Explicit, read-only live model-contract and tool smoke checks.

Run ``python -m agent.validate_models --family all --execute``.
The execute flag permits bounded inference queries, never model training.
"""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
from dataclasses import replace
from typing import Any
from google.cloud import bigquery
from google.oauth2.credentials import Credentials

from .config import AgentConfig
from .contracts import Family, exception_result
from .contracts import failure
from .planning_tools import HeatResilienceRuntime, using_runtime
from .tools import (
    predict_heat_offset_and_explain, rank_cooling_center_sites,
    predict_and_explain_location, rank_cooling_sites,
)


def check_family(
    config: AgentConfig, family: Family, execute: bool, client: bigquery.Client | None = None
) -> dict[str, Any]:
    runtime = HeatResilienceRuntime(
        replace(config, model_family=family, auto_bootstrap_bqml=False), client
    )
    try:
        metadata = runtime.validate_model(family)
        report: dict[str, Any] = {"status": "OK", "contract": metadata, "inference": "NOT_RUN"}
        if execute:
            with using_runtime(runtime):
                if family == "atlanta":
                    prediction = predict_heat_offset_and_explain(33.7537, -84.3902, baseline_forecast_f=None)
                    ranking = rank_cooling_center_sites(1)
                else:
                    city = runtime.get_city_metadata()
                    prediction = predict_and_explain_location(city.center_lat, city.center_lon)
                    ranking = rank_cooling_sites(1)
            report["inference"] = {"prediction": prediction, "ranking": ranking}
            report["status"] = (
                "OK" if prediction["status"] == ranking["status"] == "OK" else "ERROR"
            )
        return report
    except Exception as exc:
        logging.getLogger(__name__).error(
            "Live validation failed for family %s (%s)", family, type(exc).__name__
        )
        return dict(exception_result(exc))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--family", choices=["atlanta", "planning", "all"], default="all")
    parser.add_argument("--execute", action="store_true", help="Run bounded prediction/explanation and ranking queries.")
    parser.add_argument(
        "--credential-source", choices=["adc", "gcloud"], default="adc",
        help="Explicit diagnostic identity. gcloud uses the active CLI login without changing ADC.",
    )
    args = parser.parse_args()
    config = AgentConfig()
    client = None
    if args.credential_source == "gcloud":
        try:
            token = subprocess.run(
                ["gcloud", "auth", "print-access-token"],
                check=True, capture_output=True, text=True, timeout=30,
            ).stdout.strip()
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            logging.getLogger(__name__).error("Explicit gcloud diagnostic credentials unavailable")
            print(json.dumps(failure(
                "CLI_CREDENTIALS_UNAVAILABLE", "Could not obtain the explicit gcloud diagnostic identity.",
                "PERMISSION",
            )))
            return 1
        if not token:
            logging.getLogger(__name__).error("gcloud returned no diagnostic credentials")
            print(json.dumps(failure(
                "CLI_CREDENTIALS_UNAVAILABLE", "gcloud returned no access token.", "PERMISSION",
            )))
            return 1
        client = bigquery.Client(
            project=config.project_id, location=config.location, credentials=Credentials(token)
        )
    families: list[Family] = ["atlanta", "planning"] if args.family == "all" else [args.family]
    reports = {family: check_family(config, family, args.execute, client) for family in families}
    print(json.dumps(
        {"credential_source": args.credential_source, "families": reports},
        indent=2, default=str, allow_nan=False,
    ))
    return 0 if all(report["status"] == "OK" for report in reports.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
