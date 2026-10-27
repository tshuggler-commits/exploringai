"""Configuration, landmark registry, and feature metadata for the Urban Heat Resilience ADK Agent."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field


# Known street intersections and landmarks referenced in the hackathon planner prompts
# and major verified Heat Watch cities. Allows the agent to resolve named intersections
# (such as "4th and Marsalis" in Dallas or "63rd and Halsted" in Chicago) directly to
# WGS84 coordinates even without an external Google Maps Geocoding API key.
KNOWN_INTERSECTIONS: dict[str, dict[str, float | str]] = {
    "4th and marsalis": {
        "name": "E 4th St & N Marsalis Ave (Oak Cliff, Dallas)",
        "city": "Dallas",
        "latitude": 32.7485,
        "longitude": -96.8183,
    },
    "marsalis": {
        "name": "E 4th St & N Marsalis Ave (Oak Cliff, Dallas)",
        "city": "Dallas",
        "latitude": 32.7485,
        "longitude": -96.8183,
    },
    "jefferson and marsalis": {
        "name": "W Jefferson Blvd & S Marsalis Ave (Oak Cliff, Dallas)",
        "city": "Dallas",
        "latitude": 32.7432,
        "longitude": -96.8185,
    },
    "mlk and ervay": {
        "name": "Martin Luther King Jr Blvd & S Ervay St (South Dallas)",
        "city": "Dallas",
        "latitude": 32.7621,
        "longitude": -96.7654,
    },
    "singleton and hampton": {
        "name": "Singleton Blvd & N Hampton Rd (West Dallas)",
        "city": "Dallas",
        "latitude": 32.7784,
        "longitude": -96.8562,
    },
    "63rd and halsted": {
        "name": "W 63rd St & S Halsted St (Englewood, Chicago)",
        "city": "Chicago",
        "latitude": 41.7797,
        "longitude": -87.6448,
    },
    "pilsen 18th and ashland": {
        "name": "W 18th St & S Ashland Ave (Pilsen, Chicago)",
        "city": "Chicago",
        "latitude": 41.8578,
        "longitude": -87.6660,
    },
    "fifth ward jensen and navigation": {
        "name": "Jensen Dr & Navigation Blvd (Fifth Ward / East End, Houston)",
        "city": "Houston",
        "latitude": 29.7635,
        "longitude": -95.3418,
    },
    "gulfton bellaire and chimney rock": {
        "name": "Bellaire Blvd & Chimney Rock Rd (Gulfton, Houston)",
        "city": "Houston",
        "latitude": 29.7056,
        "longitude": -95.4764,
    },
    "five points peachtree and marietta": {
        "name": "Peachtree St & Marietta St (Five Points, Atlanta)",
        "city": "Atlanta",
        "latitude": 33.7537,
        "longitude": -84.3902,
    },
    "sodo 4th and lander": {
        "name": "4th Ave S & S Lander St (SoDo, Seattle)",
        "city": "Seattle",
        "latitude": 47.5798,
        "longitude": -122.3292,
    },
}

# Human-readable descriptions for BigQuery ML feature attributions returned by
# ML.EXPLAIN_PREDICT. Translates raw table column names into domain language
# suitable for city council proposals and urban planning explanations.
FEATURE_EXPLANATION_LABELS: dict[str, str] = {
    "median_year_structure_built": "median structure construction year (median_year_structure_built)",
    "structure_age_years": "older building stock & urban form (structure_age_years)",
    "housing_units": "built-environment housing density (housing_units)",
    "housing_density_proxy": "residential structure density (housing_density_proxy)",
    "total_pop": "neighborhood population concentration (total_pop)",
    "no_vehicle_rate": "household transit/walking dependency (no_vehicle_rate)",
    "no_cars": "households without vehicle access (no_cars)",
    "poverty_rate": "socioeconomic heat-exposure vulnerability proxy (poverty_rate)",
    "median_income": "median household income (median_income)",
    "median_age": "resident age profile (median_age)",
    "households": "household density (households)",
    "humidity_pct": "local relative humidity (humidity_pct)",
    "latitude": "north-south spatial microclimate gradient (latitude)",
    "longitude": "east-west spatial microclimate gradient (longitude)",
    "tract_lat": "tract north-south spatial position (tract_lat)",
    "tract_lon": "tract east-west spatial position (tract_lon)",
    "dist_from_center_km": "urban core proximity (dist_from_center_km)",
}

# Recommended physical or operational interventions mapped to dominant feature drivers
FEATURE_INTERVENTION_GUIDANCE: dict[str, dict[str, str]] = {
    "today": {
        "no_vehicle_rate": "Deploy mobile hydration unit & door-to-door wellness checks (high share of car-free households unable to drive to distant cooling centers).",
        "median_age": "Prioritize senior wellness checks and paratransit shuttle routing to extended-hour cooling shelters.",
        "poverty_rate": "Open immediate walk-in cooling shelter with free water, electrolytes, and transit vouchers.",
        "default": "Position mobile cooling & hydration unit at high-foot-traffic intersection and extend nearest public facility hours.",
    },
    "budget_cycle": {
        "no_vehicle_rate": "Fund a permanent neighborhood cooling center within a 10-minute walk; high car-free rate means regional centers do not serve this tract.",
        "median_year_structure_built": "Site a permanent community resilience hub and pair with weatherization/HVAC retrofit grants for older housing stock.",
        "structure_age_years": "Site a permanent community resilience hub and pair with weatherization/HVAC retrofit grants for older housing stock.",
        "housing_units": "Establish a high-capacity permanent cooling facility (library/rec center expansion) to serve dense residential demand.",
        "default": "Fund a permanent multi-use cooling center co-located with existing civic infrastructure along transit corridors.",
    },
    "decade": {
        "median_year_structure_built": "Prioritize cool-roof retrofits, high-albedo pavement resurfacing, and street-tree canopy corridors in older built-out blocks.",
        "structure_age_years": "Prioritize cool-roof retrofits, high-albedo pavement resurfacing, and street-tree canopy corridors in older built-out blocks.",
        "housing_units": "Target impervious-surface depaving, cool pavement coatings, and pocket-park canopy expansion in dense residential blocks.",
        "housing_density_proxy": "Target impervious-surface depaving, cool pavement coatings, and pocket-park canopy expansion in dense residential blocks.",
        "median_income": "Direct long-term urban forestry capital to reverse historic canopy disinvestment along residential sidewalks.",
        "default": "Invest in street-tree canopy planting and cool-pavement resurfacing along primary pedestrian corridors.",
    },
}


@dataclass(frozen=True)
class AgentConfig:
    """Immutable runtime configuration for BigQuery, BQML, ADK, and MCP."""

    project_id: str | None = field(
        default_factory=lambda: os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GCP_PROJECT")
        or "qwiklabs-gcp-03-1578f96a5a7a"
    )
    dataset_id: str = field(
        default_factory=lambda: os.environ.get("BQ_DATASET", "a4i_climate")
    )
    location: str = field(
        default_factory=lambda: os.environ.get("BQ_LOCATION", "US")
    )
    bqml_model_name: str = field(
        default_factory=lambda: os.environ.get("BQML_MODEL")
        or os.environ.get("BQ_MODEL_NAME")
        or "heat_offset_model"
    )
    planning_bqml_model_name: str = field(
        default_factory=lambda: os.environ.get("PLANNING_BQML_MODEL", "heat_planning_model")
    )
    gemini_model: str = field(
        default_factory=lambda: os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    )
    bbox_pad_degrees: float = field(
        default_factory=lambda: float(os.environ.get("BBOX_PAD_DEGREES", "0.03"))
    )
    explain_top_k: int = field(
        default_factory=lambda: int(os.environ.get("EXPLAIN_TOP_K", "4"))
    )
    auto_bootstrap_bqml: bool = field(
        default_factory=lambda: os.environ.get("AUTO_BOOTSTRAP_BQML", "false").lower()
        in {"1", "true", "yes"}
    )
    mcp_toolbox_url: str | None = field(
        default_factory=lambda: os.environ.get("MCP_TOOLBOX_URL")
    )
    query_timeout_seconds: int = field(
        default_factory=lambda: int(os.environ.get("BQ_QUERY_TIMEOUT_SECONDS", "60"))
    )
    maximum_bytes_billed: int = field(
        default_factory=lambda: int(os.environ.get("BQ_MAXIMUM_BYTES_BILLED", "1000000000"))
    )
    model_family: str = field(default_factory=lambda: os.environ.get("MODEL_FAMILY", "atlanta"))

    def __post_init__(self) -> None:
        if self.model_family not in {"atlanta", "planning"}:
            raise ValueError("MODEL_FAMILY must be atlanta or planning.")
        if self.bqml_model_name == self.planning_bqml_model_name:
            raise ValueError("PLANNING_BQML_MODEL must differ from BQML_MODEL.")
        identifiers = {
            "BQ_DATASET": self.dataset_id,
            "BQML_MODEL": self.bqml_model_name,
            "PLANNING_BQML_MODEL": self.planning_bqml_model_name,
        }
        for name, value in identifiers.items():
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
                raise ValueError(f"{name} must be a simple BigQuery identifier.")
        if self.project_id and not re.fullmatch(r"[A-Za-z0-9_-]+", self.project_id):
            raise ValueError("Google Cloud project must be a simple project identifier.")
        for name, value in (
            ("BQ_QUERY_TIMEOUT_SECONDS", self.query_timeout_seconds),
            ("BQ_MAXIMUM_BYTES_BILLED", self.maximum_bytes_billed),
        ):
            if type(value) is not int or value <= 0:
                raise ValueError(f"{name} must be a positive integer.")


def get_config() -> AgentConfig:
    """Return the active agent configuration."""
    return AgentConfig()
