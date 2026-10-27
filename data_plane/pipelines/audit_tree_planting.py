"""Audit planting inputs without claiming a cooling effect or cost-effectiveness."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from .train_candidate import BigQuery, DATA_PLANE, render, run_id, validate_namespace


REQUIREMENTS = (
    "source_provenance_and_license",
    "cost_currency_price_year_and_per_unit_definition",
    "plantable_area_method_boundary_vintage_and_site_feasibility",
    "species_growth_and_yearly_canopy_trajectory",
    "survival_mortality_replacement_and_maintenance",
    "causal_cooling_response_and_applicable_climate",
    "hourly_ambient_heat_and_people_present",
    "no_planting_counterfactual_and_existing_canopy_trajectory",
    "discount_rates_and_uncertainty_distributions",
)


def audit_sql(project: str, dataset: str, location: str) -> str:
    validate_namespace(project, dataset, location)
    return render((DATA_PLANE / "sql" / "audit_tree_planting.sql").read_text(),
                  {"namespace": f"{project}.{dataset}"})


def scenario_contract() -> dict[str, Any]:
    return {
        "status": "BLOCKED_MISSING_VERIFIED_INPUTS",
        "horizon": "10 years from planting; planting date must be specified",
        "objective": "Cumulative avoided human exposure to ambient heat per dollar",
        "proposed_benefit_unit": "person-degree-Celsius-hours",
        "benefit_definition": (
            "Sum over years, locations and hours of people present times the reduction in "
            "max(ambient temperature minus an agreed heat threshold, 0), relative to no planting."
        ),
        "cost_definition": (
            "Present value of incremental lifecycle costs: planting, site preparation, watering, "
            "maintenance, replacements and other declared program costs, in a stated currency "
            "and price year. Avoid counting included cost components twice."
        ),
        "ratio_definition": (
            "Expected cumulative avoided exposure / expected lifecycle cost. Report numerator, "
            "denominator and uncertainty separately; do not silently substitute mean sample ratios."
        ),
        "required_decisions": [
            "Heat threshold and whether humidity-adjusted exposure is a separate endpoint",
            "Planting date, currency, price year, cost discount rate and benefit discount convention",
            "Public budget, intervention scale, feasible sites and policy/equity constraints",
        ],
        "requirements": {name: "UNVERIFIED" for name in REQUIREMENTS},
        "relief_per_dollar": None,
        "recommended_sites": [],
        "interpretation": "A scenario estimate is not a validated causal effect or medical outcome.",
    }


def audit(bq: BigQuery, dataset: str) -> dict[str, Any]:
    sql = audit_sql(bq.project, dataset, bq.location)
    job_id = f"a4i_{bq.identifier}_planting"
    rows = bq.query(sql, "planting", job_id=job_id)
    if len(rows) != 1:
        raise ValueError(f"Expected one planting audit row, received {len(rows)}.")
    return {
        "audit_id": bq.identifier, "mode": "read_only_audit",
        "source_table": f"{bq.project}.{dataset}.atlanta_tree_planting_optimization",
        "executed_sql": sql, "sql_sha256": hashlib.sha256(sql.encode()).hexdigest(),
        "job": bq.job_statistics(job_id), "evidence": rows[0],
        "scenario": scenario_contract(),
        "limitations": [
            "Current source reads, not immutable source snapshots.",
            "Range checks do not verify units, provenance or whether fields are synthetic.",
            "Negative LST is flagged for review only; temperature units are unverified.",
            "Ranking coverage mirrors the agent eligibility filter, not validated geographic support.",
            "Land-surface temperature is not ambient temperature or human exposure.",
            "Tract resident population is not hourly pedestrian presence.",
            "Canopy correlation and model attribution do not establish intervention cooling.",
            "No training, ranking by cost-effectiveness, promotion or agent change is performed.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--dataset", default=os.environ.get("BQ_DATASET", "a4i_climate"))
    parser.add_argument("--location", default=os.environ.get("BQ_LOCATION", "US"))
    parser.add_argument("--output", type=Path, help="Create a new local JSON report.")
    args = parser.parse_args()
    if not args.project:
        parser.error("Set GOOGLE_CLOUD_PROJECT or pass --project.")
    sql = audit_sql(args.project, args.dataset, args.location)
    if not args.execute:
        print(json.dumps({"mode": "plan_only", "sql": sql, "scenario": scenario_contract(),
                          "writes_to_bigquery": False}, indent=2))
        return
    if args.output and args.output.exists():
        parser.error("--output must refer to a new file.")
    result = audit(BigQuery(args.project, args.location, run_id(), 1_000_000_000), args.dataset)
    document = json.dumps(result, indent=2, allow_nan=False) + "\n"
    if args.output:
        with args.output.open("x") as output:
            output.write(document)
    print(document, end="")


if __name__ == "__main__":
    main()
