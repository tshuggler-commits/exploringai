"""
Custom BigQuery & BQML tools for Atlanta Heat Resilience Planning Assistant.
"""

import logging
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from .contracts import ToolFailure, explained_features, required_number, tool_boundary
from .planning_tools import (
    CUSTOM_HEAT_TOOLS,
    HeatResilienceRuntime,
    audit_recommendations_equity,
    bigquery,
    format_feature_attributions,
    get_runtime,
    get_station_heat_frequency,
    predict_and_explain_location,
    rank_cooling_sites,
    set_runtime,
)

__all__ = [
    "predict_heat_offset_and_explain",
    "compare_locations_and_explain",
    "compare_census_tracts",
    "rank_cooling_center_sites",
    "query_heat_history",
    "get_tract_demographics",
    "audit_equity",
    "recommend_canopy_interventions",
    "generate_council_proposal",
    "CUSTOM_HEAT_TOOLS",
    "HeatResilienceRuntime",
    "audit_recommendations_equity",
    "format_feature_attributions",
    "get_runtime",
    "get_station_heat_frequency",
    "predict_and_explain_location",
    "rank_cooling_sites",
    "set_runtime",
]

logger = logging.getLogger(__name__)
_CLEAN_TRACTS_SQL = Path(__file__).with_name("sql").joinpath("clean_tracts.sql").read_text()


def _clean_tracts_sql() -> str:
    return _CLEAN_TRACTS_SQL.replace(
        "{{tract_source}}", f"{get_runtime().dataset_fqn}.tract_demographics"
    )


def _canopy_sql() -> str:
    return f"""
    SELECT GEOID,
      AVG(CASE WHEN tree_canopy_pct BETWEEN 0 AND 1 THEN tree_canopy_pct * 100
               WHEN tree_canopy_pct BETWEEN 0 AND 100 THEN tree_canopy_pct END) AS tree_canopy_pct,
      AVG(integrated_risk_score) AS integrated_risk_score
    FROM `{get_runtime().dataset_fqn}.atlanta_canopy_heat_svi_modeling`
    GROUP BY GEOID
    """


def _error(code: str, message: str) -> Dict[str, Any]:
    logger.warning("Atlanta tool rejected request: %s", code)
    return {"status": "ERROR", "error_code": code, "error": message}


def _finite_number(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def _valid_tract_id(value: Any) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[0-9]{11}", value) is not None


def _valid_model_name(value: Optional[str]) -> bool:
    return value is None or (
        isinstance(value, str) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value) is not None
    )


def _location_error(
    latitude: Optional[float], longitude: Optional[float], tract_id: Optional[str]
) -> Optional[Dict[str, Any]]:
    if tract_id is not None and not _valid_tract_id(tract_id):
        return _error("INVALID_TRACT_ID", "tract_id must be an 11-digit Census GEOID.")
    if latitude is None and longitude is None and tract_id is not None:
        return None
    if latitude is None or longitude is None or not (
        _finite_number(latitude) and _finite_number(longitude)
    ):
        return _error("INVALID_COORDINATES", "Provide a tract_id or a finite coordinate pair.")
    if not (33.55 <= latitude <= 34.02 and -84.60 <= longitude <= -84.15):
        return _error("OUT_OF_BOUNDS", "Coordinates are outside the supported Atlanta metro bounds.")
    return None


@tool_boundary
def predict_heat_offset_and_explain(
    latitude: Optional[float] = None, 
    longitude: Optional[float] = None, 
    tract_id: Optional[str] = None,
    baseline_forecast_f: Optional[float] = 102.0,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Predicts the urban heat offset in degrees Fahrenheit for any location or Census tract in Atlanta 
    and returns feature attributions using BigQuery ML.EXPLAIN_PREDICT.

    Args:
        latitude: Latitude coordinate of the location (optional if tract_id provided).
        longitude: Longitude coordinate of the location (optional if tract_id provided).
        tract_id: 11-digit Census tract GEOID (optional if coordinates provided).
        baseline_forecast_f: Regional baseline forecast temperature in Fahrenheit (default 102.0).
        model_name: Optional simple model name in the configured dataset for explicit candidate testing.

    Returns:
        Dict with predicted offset, predicted temperature, top feature attributions, and demographic context.
    """
    if not _valid_model_name(model_name):
        return _error("INVALID_MODEL", "model_name must be a simple BigQuery model identifier.")
    target_model = model_name or get_runtime().config.bqml_model_name
    invalid = _location_error(latitude, longitude, tract_id)
    if invalid is not None:
        return invalid
    if baseline_forecast_f is not None and not _finite_number(baseline_forecast_f):
        return _error("INVALID_BASELINE", "baseline_forecast_f must be finite or null.")
    if tract_id and (latitude is None or longitude is None):
        coord_query = f"""
        SELECT tract_lat, tract_lon FROM `{get_runtime().dataset_fqn}.tract_demographics`
        WHERE geo_id = @tract_id LIMIT 1
        """
        coord_config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("tract_id", "STRING", tract_id)]
        )
        coord_res = get_runtime().query_rows(coord_query, coord_config)
        if coord_res:
            latitude = coord_res[0].tract_lat
            longitude = coord_res[0].tract_lon
        else:
            return _error("TRACT_NOT_FOUND", f"Tract ID {tract_id} not found in Atlanta demographics.")

    invalid = _location_error(latitude, longitude, None)
    if invalid is not None:
        return invalid
    provenance = get_runtime().validate_model("atlanta", target_model)

    sql = f"""
    WITH cleaned_tracts AS (
      {_clean_tracts_sql()}
    ), canopy AS (
      {_canopy_sql()}
    ), tract AS (
      SELECT d.*, c.tree_canopy_pct
      FROM cleaned_tracts d
      LEFT JOIN canopy c ON d.geo_id = c.GEOID
      WHERE @tract_id IS NULL OR geo_id = @tract_id
      ORDER BY ST_DISTANCE(ST_GEOGPOINT(@lon, @lat), ST_GEOGPOINT(tract_lon, tract_lat)), geo_id
      LIMIT 1
    )
    SELECT 
      p.predicted_offset_f,
      p.top_feature_attributions,
      t.*
    FROM ML.EXPLAIN_PREDICT(
      MODEL `{get_runtime().dataset_fqn}.{target_model}`,
      (
        SELECT 
          @lat AS latitude,
          @lon AS longitude,
          median_income,
          poverty_rate,
          no_vehicle_rate,
          median_age,
          housing_units,
          median_year_structure_built
        FROM tract
      ),
      STRUCT(3 as top_k_features)
    ) p
    CROSS JOIN tract t
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("lat", "FLOAT64", latitude),
            bigquery.ScalarQueryParameter("lon", "FLOAT64", longitude),
            bigquery.ScalarQueryParameter("tract_id", "STRING", tract_id),
            bigquery.ScalarQueryParameter("reference_time", "TIMESTAMP", datetime.now(timezone.utc)),
        ]
    )
    results = get_runtime().query_rows(sql, job_config)
    if not results:
        return _error("NO_PREDICTION", "No model prediction available for this location.")
    
    row = results[0]
    offset = round(required_number(row, "predicted_offset_f"), 2)
    predicted_temp = round(baseline_forecast_f + offset, 2) if baseline_forecast_f is not None else None
    
    attributions = []
    for attr in explained_features(row.top_feature_attributions, "atlanta"):
        feat = attr["feature"]
        weight = round(attr["attribution"], 2)
        attributions.append({"feature": feat, "attribution_deg_f": weight})
        
    return {
        "status": "OK",
        "provenance": {
            "model": f"{get_runtime().dataset_fqn}.{target_model}",
            "model_family": "atlanta",
            "model_etag": provenance["model_etag"],
            "preprocessing_contract": "data-lane/831a7f7/eight-feature",
            "temperature_units": "degF",
            "limitations": [
                "Campaign-relative offset, not a live forecast or a surface-temperature measurement.",
                "Feature attributions are predictive associations, not causal effects.",
                "Canopy is not an input to this model.",
            ],
        },
        "location": {"latitude": latitude, "longitude": longitude},
        "tract_id": row.geo_id,
        "predicted_heat_offset_f": offset,
        "baseline_forecast_f": baseline_forecast_f,
        "predicted_surface_temp_f": predicted_temp,
        "top_feature_attributions": attributions,
        "demographics": {
            "total_pop": int(row.total_pop) if row.total_pop else None,
            "poverty_rate_pct": round(row.poverty_rate * 100, 1),
            "no_vehicle_rate_pct": round(row.no_vehicle_rate * 100, 1),
            "median_age": round(row.median_age, 1),
            "median_year_structure_built": int(row.median_year_structure_built),
            "tree_canopy_pct": getattr(row, "tree_canopy_pct", None),
        }
    }


@tool_boundary
def compare_locations_and_explain(
    lat1: float, 
    lon1: float, 
    label1: str, 
    lat2: float, 
    lon2: float, 
    label2: str,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Compares heat risk and underlying drivers between two Atlanta locations.
    Answers questions like 'Why is intersection A so much worse than intersection B?'

    Args:
        lat1: Latitude of first site.
        lon1: Longitude of first site.
        label1: Name or description of first site (e.g. 'South Pryor St').
        lat2: Latitude of second site.
        lon2: Longitude of second site.
        label2: Name or description of second site (e.g. 'Piedmont Park').
        model_name: Optional model override for both sites in the configured dataset.

    Returns:
        Dict detailing the offset differential and comparative feature breakdown.
    """
    for lat, lon in ((lat1, lon1), (lat2, lon2)):
        invalid = _location_error(lat, lon, None)
        if invalid is not None:
            return invalid
    site1 = predict_heat_offset_and_explain(lat1, lon1, model_name=model_name)
    if "error" in site1:
        return {**site1, "failed_site": "site_1"}
    site2 = predict_heat_offset_and_explain(lat2, lon2, model_name=model_name)
    if "error" in site2:
        return {**site2, "failed_site": "site_2"}
    
    diff_f = round(site1["predicted_heat_offset_f"] - site2["predicted_heat_offset_f"], 2)
    canopy1 = site1.get("demographics", {}).get("tree_canopy_pct")
    canopy2 = site2.get("demographics", {}).get("tree_canopy_pct")
    canopy_summary = (
        f" Tree canopy cover: {label1} has {canopy1}% versus {label2} with {canopy2}%."
        if canopy1 is not None and canopy2 is not None else ""
    )
    return {
        "site_1": {"name": label1, "details": site1},
        "site_2": {"name": label2, "details": site2},
        "temperature_difference_f": diff_f,
        "comparison_summary": (
            f"{label1} is predicted to be {abs(diff_f)}°F "
            f"{'hotter than' if diff_f > 0 else 'cooler than' if diff_f < 0 else 'different from'} {label2}.{canopy_summary}"
        )
    }


@tool_boundary
def rank_cooling_center_sites(
    top_n: int = 3, 
    focus_criteria: str = "vulnerability_and_heat",
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ranks candidate cooling center locations across Atlanta by combining BQML heat offset 
    predictions with Census demographic vulnerability (poverty and vehicle access).

    Args:
        top_n: Number of recommendations to return (default 3).
        focus_criteria: Ranking methodology, e.g. 'vulnerability_and_heat' or 'pure_heat'.
        model_name: Optional simple model name in the configured dataset for candidate testing.

    Returns:
        Dict with ranked candidate sites, coordinates, demographic stats, and siting justification.
    """
    if type(top_n) is not int or not 1 <= top_n <= 20:
        return _error("INVALID_LIMIT", "top_n must be an integer between 1 and 20.")
    if focus_criteria not in ("vulnerability_and_heat", "pure_heat"):
        return _error("INVALID_CRITERIA", "focus_criteria must be vulnerability_and_heat or pure_heat.")
    if not _valid_model_name(model_name):
        return _error("INVALID_MODEL", "model_name must be a simple BigQuery model identifier.")
    target_model = model_name or get_runtime().config.bqml_model_name
    provenance = get_runtime().validate_model("atlanta", target_model)
    order_column = "offset_f" if focus_criteria == "pure_heat" else "composite_vulnerability_score"
    sql = f"""
    WITH cleaned_tracts AS (
      {_clean_tracts_sql()}
    ), candidate_tracts AS (
      SELECT
        t.geo_id,
        t.tract_lat,
        t.tract_lon,
        t.total_pop,
        t.median_age,
        t.median_income,
        t.housing_units,
        t.median_year_structure_built,
        t.no_vehicle_rate,
        t.poverty_rate,
        p.predicted_offset_f,
        p.top_feature_attributions
      FROM cleaned_tracts t,
      ML.EXPLAIN_PREDICT(
        MODEL `{get_runtime().dataset_fqn}.{target_model}`,
        (
          SELECT 
            geo_id,
            tract_lat AS latitude,
            tract_lon AS longitude,
            median_income,
            poverty_rate,
            no_vehicle_rate,
            median_age,
            housing_units,
            median_year_structure_built
          FROM cleaned_tracts
        ),
        STRUCT(3 AS top_k_features)
      ) p
      WHERE t.geo_id = p.geo_id
        AND t.tract_lat BETWEEN 33.55 AND 34.02
        AND t.tract_lon BETWEEN -84.60 AND -84.15
        AND t.total_pop > 400
    )
    SELECT 
      geo_id,
      tract_lat,
      tract_lon,
      ROUND(predicted_offset_f, 2) AS offset_f,
      top_feature_attributions,
      (SELECT c.tree_canopy_pct FROM ({_canopy_sql()}) c WHERE c.GEOID = candidate.geo_id) AS tree_canopy_pct,
      ROUND(total_pop) AS total_pop,
      ROUND(poverty_rate * 100, 1) AS poverty_pct,
      ROUND(no_vehicle_rate * 100, 1) AS no_vehicle_pct,
      ROUND(median_age, 1) AS median_age,
      ROUND(
        (predicted_offset_f * 0.4) + 
        (COALESCE(poverty_rate, 0) * 10.0 * 0.3) + 
        (COALESCE(no_vehicle_rate, 0) * 10.0 * 0.3),
        2
      ) AS composite_vulnerability_score
    FROM candidate_tracts AS candidate
    ORDER BY {order_column} DESC, geo_id
    LIMIT @top_n
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("top_n", "INT64", top_n),
        bigquery.ScalarQueryParameter("reference_time", "TIMESTAMP", datetime.now(timezone.utc)),
    ])
    rows = get_runtime().query_rows(sql, job_config)
    if not rows:
        raise ToolFailure("NO_SITES", "No cooling-center candidates are available.")
    sites = []
    for i, r in enumerate(rows, 1):
        for key in ("tract_lat", "tract_lon", "total_pop", "poverty_pct",
                    "no_vehicle_pct", "median_age", "composite_vulnerability_score"):
            required_number(r, key)
        sites.append({
            "rank": i,
            "tract_id": r.geo_id,
            "latitude": r.tract_lat,
            "longitude": r.tract_lon,
            "predicted_heat_offset_f": required_number(r, "offset_f"),
            "population": int(r.total_pop) if r.total_pop else None,
            "poverty_rate_pct": r.poverty_pct,
            "no_vehicle_rate_pct": r.no_vehicle_pct,
            "median_age": r.median_age,
            "composite_score": r.composite_vulnerability_score,
            "tree_canopy_pct": r.tree_canopy_pct,
            "top_feature_attributions": [
                {"feature": a["feature"], "attribution_deg_f": round(a["attribution"], 2)}
                for a in explained_features(r.top_feature_attributions, "atlanta")
            ],
        })
    return {"ranked_sites": sites, "count": len(sites), "provenance": provenance}


@tool_boundary
def query_heat_history(
    min_temp_f: float = 90.0, 
    start_year: int = 2018
) -> Dict[str, Any]:
    """
    Queries historical weather station data for Atlanta to determine how often 
    temperatures reach extreme or dangerous thresholds, and whether frequency is increasing.

    Args:
        min_temp_f: Temperature threshold in Fahrenheit (e.g. 90.0, 95.0, or 100.0).
        start_year: Beginning calendar year to analyze (default 2018).

    Returns:
        Dict with year-by-year counts of days exceeding the threshold and multi-year trend.
    """
    if not _finite_number(min_temp_f) or not 40 <= min_temp_f <= 135:
        return _error("INVALID_THRESHOLD", "min_temp_f must be finite and between 40 and 135 degF.")
    if type(start_year) is not int or not 1800 <= start_year <= datetime.now(timezone.utc).year:
        return _error("INVALID_YEAR", "start_year must be between 1800 and the current year.")
    sql = f"""
    SELECT 
      EXTRACT(YEAR FROM observation_date) AS year,
      COUNT(DISTINCT IF(max_temp_f >= @min_temp_f, observation_date, NULL)) AS days_exceeding_threshold,
      ROUND(MAX(max_temp_f), 1) AS peak_temp_f,
      ROUND(AVG(IF(EXTRACT(MONTH FROM observation_date) IN (6, 7, 8), max_temp_f, NULL)), 1) AS avg_summer_max_f
    FROM `{get_runtime().dataset_fqn}.station_daily_temps`
    WHERE observation_date >= DATE(@start_year, 1, 1)
      AND max_temp_f IS NOT NULL
    GROUP BY 1
    ORDER BY 1
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("min_temp_f", "FLOAT64", min_temp_f),
        bigquery.ScalarQueryParameter("start_year", "INT64", start_year),
    ])
    rows = get_runtime().query_rows(sql, job_config)
    if not rows:
        raise ToolFailure("STATION_HISTORY_EMPTY", "No station observations are available for this period.")
    history = []
    for r in rows:
        history.append({
            "year": r.year,
            "days_exceeding": r.days_exceeding_threshold,
            "peak_temp_f": r.peak_temp_f,
            "avg_max_temp_f": r.avg_summer_max_f
        })
    return {
        "threshold_deg_f": min_temp_f,
        "start_year": start_year,
        "yearly_records": history,
        "summary": f"Historical days exceeding {min_temp_f}°F across Atlanta stations from {start_year} to present."
    }


@tool_boundary
def get_tract_demographics(
    latitude: Optional[float] = None, 
    longitude: Optional[float] = None,
    tract_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Looks up detailed Census tract demographics for any Atlanta location coordinates or tract GEOID.

    Args:
        latitude: Latitude coordinate (optional if tract_id provided).
        longitude: Longitude coordinate (optional if tract_id provided).
        tract_id: 11-digit Census tract GEOID (optional if coordinates provided).

    Returns:
        Dict with tract ID, population, median age, income, housing age, and mobility access.
    """
    invalid = _location_error(latitude, longitude, tract_id)
    if invalid is not None:
        return invalid
    if tract_id:
        sql = f"""
        SELECT 
          geo_id,
          tract_lat,
          tract_lon,
          total_pop,
          median_age,
          median_income,
          housing_units,
          median_year_structure_built,
          no_cars,
          households,
          ROUND(poverty_rate * 100, 1) AS poverty_pct,
          ROUND(no_vehicle_rate * 100, 1) AS no_vehicle_pct
        FROM `{get_runtime().dataset_fqn}.tract_demographics`
        WHERE geo_id = @tract_id
        LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("tract_id", "STRING", tract_id)
            ]
        )
    elif latitude is not None and longitude is not None:
        sql = f"""
        SELECT 
          geo_id,
          tract_lat,
          tract_lon,
          total_pop,
          median_age,
          median_income,
          housing_units,
          median_year_structure_built,
          no_cars,
          households,
          ROUND(poverty_rate * 100, 1) AS poverty_pct,
          ROUND(no_vehicle_rate * 100, 1) AS no_vehicle_pct
        FROM `{get_runtime().dataset_fqn}.tract_demographics`
        WHERE tract_lat BETWEEN -90 AND 90 AND tract_lon BETWEEN -180 AND 180
        ORDER BY ST_DISTANCE(ST_GEOGPOINT(@lon, @lat), ST_GEOGPOINT(tract_lon, tract_lat)), geo_id
        LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("lat", "FLOAT64", latitude),
                bigquery.ScalarQueryParameter("lon", "FLOAT64", longitude),
            ]
        )
    else:
        return _error("INVALID_LOCATION", "Provide a tract_id or coordinate pair.")

    results = get_runtime().query_rows(sql, job_config)
    if not results:
        return _error("TRACT_NOT_FOUND", "No demographic data found for this location or tract ID.")
    r = results[0]
    canopy_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("tract_id", "STRING", r.geo_id),
    ])
    canopy_rows = get_runtime().query_rows(
        f"SELECT * FROM ({_canopy_sql()}) WHERE GEOID = @tract_id", canopy_config
    )
    canopy = canopy_rows[0] if canopy_rows else None
    return {
        "tract_id": r.geo_id,
        "latitude": r.tract_lat,
        "longitude": r.tract_lon,
        "total_population": int(r.total_pop) if r.total_pop else None,
        "median_age": r.median_age,
        "median_household_income": r.median_income,
        "housing_units": int(r.housing_units) if r.housing_units else None,
        "median_year_built": int(r.median_year_structure_built) if r.median_year_structure_built else None,
        "households_without_vehicle": int(r.no_cars) if r.no_cars else None,
        "poverty_rate_pct": r.poverty_pct,
        "no_vehicle_rate_pct": r.no_vehicle_pct,
        "tree_canopy_pct": canopy.tree_canopy_pct if canopy is not None else None,
        "integrated_risk_score": canopy.integrated_risk_score if canopy is not None else None,
    }


@tool_boundary
def compare_census_tracts(
    tract_id_1: str, 
    tract_id_2: str,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Compares two Atlanta Census tracts side-by-side on heat risk, feature attributions, 
    and demographics to weigh municipal tradeoffs when siting cooling centers.

    Args:
        tract_id_1: First 11-digit Census tract GEOID (e.g. '13121006802').
        tract_id_2: Second 11-digit Census tract GEOID (e.g. '13121007808').
        model_name: Optional model override for both tracts in the configured dataset.

    Returns:
        Dict detailing direct comparisons, trade-offs, and strategic considerations for each site.
    """
    if not (_valid_tract_id(tract_id_1) and _valid_tract_id(tract_id_2)):
        return _error("INVALID_TRACT_ID", "Both tract IDs must be 11-digit Census GEOIDs.")
    site1 = predict_heat_offset_and_explain(tract_id=tract_id_1, model_name=model_name)
    site2 = predict_heat_offset_and_explain(tract_id=tract_id_2, model_name=model_name)
    
    if "error" in site1:
        return {**site1, "failed_site": "tract_1"}
    if "error" in site2:
        return {**site2, "failed_site": "tract_2"}
    pop1 = required_number(site1["demographics"], "total_pop")
    pop2 = required_number(site2["demographics"], "total_pop")
        
    diff_offset = round(site1["predicted_heat_offset_f"] - site2["predicted_heat_offset_f"], 2)
    
    return {
        "tract_1": {
            "tract_id": tract_id_1,
            "predicted_heat_offset_f": site1["predicted_heat_offset_f"],
            "top_attributions": site1["top_feature_attributions"],
            "demographics": site1["demographics"]
        },
        "tract_2": {
            "tract_id": tract_id_2,
            "predicted_heat_offset_f": site2["predicted_heat_offset_f"],
            "top_attributions": site2["top_feature_attributions"],
            "demographics": site2["demographics"]
        },
        "comparison_metrics": {
            "heat_offset_difference_f": diff_offset,
            "hotter_tract": tract_id_1 if diff_offset > 0 else tract_id_2,
            "larger_population_tract": tract_id_1 if pop1 > pop2 else tract_id_2,
            "higher_poverty_tract": tract_id_1 if site1["demographics"]["poverty_rate_pct"] > site2["demographics"]["poverty_rate_pct"] else tract_id_2,
            "higher_transit_dependency_tract": tract_id_1 if site1["demographics"]["no_vehicle_rate_pct"] > site2["demographics"]["no_vehicle_rate_pct"] else tract_id_2,
            "lower_tree_canopy_tract": (
                None if site1["demographics"]["tree_canopy_pct"] is None
                or site2["demographics"]["tree_canopy_pct"] is None
                or site1["demographics"]["tree_canopy_pct"] == site2["demographics"]["tree_canopy_pct"]
                else tract_id_1 if site1["demographics"]["tree_canopy_pct"] < site2["demographics"]["tree_canopy_pct"]
                else tract_id_2
            ),
        }
    }


@tool_boundary
def audit_equity(selected_tract_ids: List[str]) -> Dict[str, Any]:
    """
    Audits candidate or selected cooling center locations against citywide benchmarks 
    to verify whether resource placement reaches the most vulnerable populations.

    Args:
        selected_tract_ids: List of 11-digit Census tract GEOIDs being proposed.

    Returns:
        Dict comparing selected sites against citywide 75th percentile and average poverty/mobility rates.
    """
    if not isinstance(selected_tract_ids, list) or not 1 <= len(selected_tract_ids) <= 100:
        return _error("INVALID_TRACTS", "Provide between 1 and 100 tract IDs.")
    if not all(_valid_tract_id(tid) for tid in selected_tract_ids):
        return _error("INVALID_TRACT_ID", "Every tract ID must be an 11-digit Census GEOID.")
    selected_tract_ids = list(dict.fromkeys(selected_tract_ids))
        
    sql = f"""
    WITH valid_demographics AS (
      SELECT * FROM `{get_runtime().dataset_fqn}.tract_demographics`
      WHERE poverty_rate BETWEEN 0 AND 1
        AND no_vehicle_rate BETWEEN 0 AND 1 AND total_pop >= 0
    ), city_baseline AS (
      SELECT
        AVG(poverty_rate) AS city_avg_poverty,
        AVG(no_vehicle_rate) AS city_avg_no_vehicle,
        APPROX_QUANTILES(poverty_rate, 100)[OFFSET(75)] AS p75_poverty,
        APPROX_QUANTILES(no_vehicle_rate, 100)[OFFSET(75)] AS p75_no_vehicle
      FROM valid_demographics
      WHERE total_pop > 100
    ),
    selected AS (
      SELECT
        geo_id,
        poverty_rate,
        no_vehicle_rate,
        total_pop
      FROM valid_demographics
      WHERE geo_id IN UNNEST(@tract_ids)
    )
    SELECT
      ROUND(b.city_avg_poverty * 100, 1) AS city_avg_poverty_pct,
      ROUND(AVG(s.poverty_rate) * 100, 1) AS selected_avg_poverty_pct,
      ROUND(b.p75_poverty * 100, 1) AS city_p75_poverty_pct,
      ROUND(b.city_avg_no_vehicle * 100, 1) AS city_avg_no_vehicle_pct,
      ROUND(AVG(s.no_vehicle_rate) * 100, 1) AS selected_avg_no_vehicle_pct,
      ROUND(b.p75_no_vehicle * 100, 1) AS city_p75_no_vehicle_pct,
      SUM(s.total_pop) AS total_served_pop,
      COUNT(DISTINCT s.geo_id) AS matched_tract_count,
      CASE 
        WHEN AVG(s.poverty_rate) >= b.p75_poverty AND AVG(s.no_vehicle_rate) >= b.p75_no_vehicle 
        THEN 'PASSED: Recommended placements concentrate in the highest quartile (top 25%) of economic and mobility vulnerability.'
        WHEN AVG(s.poverty_rate) >= b.city_avg_poverty OR AVG(s.no_vehicle_rate) >= b.city_avg_no_vehicle
        THEN 'MODERATE: Recommendations exceed city averages, but some sites fall outside the highest-need quartile.'
        ELSE 'FAILED: Recommendations under-serve vulnerable communities relative to the citywide baseline.'
      END AS audit_status
    FROM selected s
    CROSS JOIN city_baseline b
    GROUP BY b.city_avg_poverty, b.city_avg_no_vehicle, b.p75_poverty, b.p75_no_vehicle
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ArrayQueryParameter("tract_ids", "STRING", selected_tract_ids),
    ])
    results = get_runtime().query_rows(sql, job_config)
    if not results:
        return _error("NO_AUDIT_DATA", "Unable to compute equity audit for specified tracts.")
    r = results[0]
    if r.matched_tract_count != len(selected_tract_ids):
        return _error("TRACTS_NOT_FOUND", "One or more requested tracts were not found; audit is incomplete.")
    for key in ("city_avg_poverty_pct", "selected_avg_poverty_pct", "city_p75_poverty_pct",
                "city_avg_no_vehicle_pct", "selected_avg_no_vehicle_pct",
                "city_p75_no_vehicle_pct", "total_served_pop"):
        required_number(r, key)
    return {
        "selected_tract_count": len(selected_tract_ids),
        "total_population_served": int(r.total_served_pop) if r.total_served_pop else None,
        "poverty_comparison": {
            "selected_sites_avg_pct": r.selected_avg_poverty_pct,
            "citywide_avg_pct": r.city_avg_poverty_pct,
            "citywide_75th_percentile_pct": r.city_p75_poverty_pct
        },
        "mobility_access_comparison": {
            "selected_sites_no_vehicle_avg_pct": r.selected_avg_no_vehicle_pct,
            "citywide_avg_no_vehicle_pct": r.city_avg_no_vehicle_pct,
            "citywide_75th_percentile_no_vehicle_pct": r.city_p75_no_vehicle_pct
        },
        "audit_finding": r.audit_status
    }


@tool_boundary
def recommend_canopy_interventions(
    top_n: int = 5, min_pop_density: float = 1000.0
) -> Dict[str, Any]:
    """Rank Atlanta canopy interventions using measured heat and contextual SVI.

    Args:
        top_n: Number of priority tracts, between 1 and 20.
        min_pop_density: Minimum population density per square mile.
    """
    if type(top_n) is not int or not 1 <= top_n <= 20:
        return _error("INVALID_LIMIT", "top_n must be an integer between 1 and 20.")
    if not _finite_number(min_pop_density) or min_pop_density < 0:
        return _error("INVALID_DENSITY", "min_pop_density must be finite and nonnegative.")
    sql = f"""
    SELECT GEOID AS tract_id, NAME AS tract_name, POP100 AS population,
      ROUND(pop_density, 1) AS pop_density, ROUND(mean_temp, 1) AS mean_temp_f,
      ROUND(CASE WHEN tree_canopy_pct <= 1 THEN tree_canopy_pct * 100
                 ELSE tree_canopy_pct END, 1) AS tree_canopy_pct,
      ROUND(RPL_THEMES, 3) AS svi_percentile,
      ROUND(integrated_risk_score, 2) AS integrated_risk_score,
      ROUND(EP_POV150, 1) AS poverty_pct, ROUND(EP_NOVEH, 1) AS no_vehicle_pct
    FROM `{get_runtime().dataset_fqn}.atlanta_canopy_heat_svi_modeling`
    WHERE pop_density >= @min_pop_density AND tree_canopy_pct BETWEEN 0 AND 100
    ORDER BY integrated_risk_score DESC, tree_canopy_pct ASC, GEOID
    LIMIT @top_n
    """
    config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("top_n", "INT64", top_n),
        bigquery.ScalarQueryParameter("min_pop_density", "FLOAT64", min_pop_density),
    ])
    recommendations = []
    for row in get_runtime().query_rows(sql, config):
        required_number(row, "tree_canopy_pct")
        required_number(row, "integrated_risk_score")
        actions = [
            "Right-of-way street tree planting along pedestrian and transit corridors",
            "Cool pavement and reflective surface treatments for unshaded asphalt",
        ]
        if (row.no_vehicle_pct or 0) > 20:
            actions.append("Shaded bus stop canopy retrofits and cooling shelters")
        if (row.poverty_pct or 0) > 25:
            actions.append("Residential tree distribution and community green space expansion")
        recommendations.append({
            "tract_id": row.tract_id, "tract_name": row.tract_name,
            "population": int(row.population) if row.population is not None else None,
            "pop_density_per_sq_mi": row.pop_density,
            "mean_summer_temp_f": row.mean_temp_f,
            "tree_canopy_pct": row.tree_canopy_pct,
            "city_target_gap_pct": round(max(0, 50 - row.tree_canopy_pct), 1),
            "social_vulnerability_index": row.svi_percentile,
            "integrated_risk_score": row.integrated_risk_score,
            "poverty_pct": row.poverty_pct, "no_vehicle_pct": row.no_vehicle_pct,
            "priority_interventions": actions,
        })
    if not recommendations:
        raise ToolFailure("NO_CANOPY_DATA", "No canopy candidates match the requested criteria.")
    return {
        "city_target_canopy_pct": 50.0,
        "recommended_priority_tracts": recommendations,
        "count": len(recommendations),
        "strategic_framework": "Atlanta Decade Track Urban Forestry & Heat Equity Plan",
    }


@tool_boundary
def generate_council_proposal(
    top_n: int = 3,
    baseline_forecast_f: float = 102.0,
    funding_source: str = "Atlanta Climate Resilience Emergency Fund",
) -> Dict[str, Any]:
    """Build a council memo from verified rankings, equity, and canopy context.

    Args:
        top_n: Number of cooling-center priority tracts, between 1 and 20.
        baseline_forecast_f: User-supplied regional scenario baseline in Fahrenheit.
        funding_source: Proposed funding vehicle; availability is not verified.
    """
    if not _finite_number(baseline_forecast_f):
        return _error("INVALID_BASELINE", "baseline_forecast_f must be finite.")
    if not isinstance(funding_source, str) or not funding_source.strip():
        return _error("INVALID_FUNDING", "funding_source must be a nonempty string.")
    ranking = rank_cooling_center_sites(top_n)
    if "error" in ranking:
        return ranking
    sites = ranking["ranked_sites"]
    if not sites:
        return _error("NO_SITES", "No cooling-center candidates available.")
    audit = audit_equity([site["tract_id"] for site in sites])
    if "error" in audit:
        return audit
    canopy = recommend_canopy_interventions(top_n)
    if "error" in canopy:
        return canopy
    lines = [
        "# MEMORANDUM", "", "**TO:** Atlanta City Council",
        "**FROM:** Office of Sustainability and Resilience",
        f"**DATE:** {datetime.now(timezone.utc).date().isoformat()}",
        "**SUBJECT:** Proposed cooling-center and canopy priorities", "",
        "## Executive Summary",
        f"Recommend feasibility review of {len(sites)} priority tracts using a "
        f"{baseline_forecast_f} F regional scenario baseline.", "",
        "## Priority Cooling Center Deployments",
    ]
    for site in sites:
        attrs = "; ".join(
            f"{a['feature']}: {a['attribution_deg_f']:+.2f} F"
            for a in site["top_feature_attributions"]
        ) or "No feature attributions returned."
        lines.extend([
            f"### Census Tract {site['tract_id']}",
            f"- Coordinates: {site['latitude']}, {site['longitude']}",
            f"- Heat offset: {site['predicted_heat_offset_f']:+.2f} F; "
            f"baseline plus offset: {baseline_forecast_f + site['predicted_heat_offset_f']:.2f} F.",
            f"- Population: {site['population']}; poverty: {site['poverty_rate_pct']}%; "
            f"no-vehicle households: {site['no_vehicle_rate_pct']}%.",
            f"- Predictive associations (not causal effects): {attrs}",
        ])
    lines.extend(["", "## Equity Audit", audit["audit_finding"], "",
                  "## Long-Term Canopy Priorities"])
    for tract in canopy["recommended_priority_tracts"]:
        lines.append(
            f"- Tract {tract['tract_id']}: canopy {tract['tree_canopy_pct']}%; "
            f"gap to 50% planning target: {tract['city_target_gap_pct']} percentage points."
        )
    lines.extend([
        "", "## Funding & Limitations", f"Proposed funding source: {funding_source}.",
        "Funding, facility availability, capacity, and walkability require independent verification.",
        "Campaign offsets are not live forecasts or surface-temperature measurements.",
        "Canopy is contextual data, not a prediction input or a modeled intervention effect.",
        "Race and ethnicity are excluded from prediction; economic tract features remain inputs.",
    ])
    return {
        "title": "Atlanta Emergency Cooling Center Mobilization & Canopy Mitigation Plan",
        "target_tract_ids": [site["tract_id"] for site in sites],
        "funding_source": funding_source,
        "proposal_markdown": "\n".join(lines),
        "recommended_sites": sites,
        "equity_audit": audit,
        "canopy_interventions": canopy,
    }
