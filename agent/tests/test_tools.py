"""Unit tests for the Urban Heat Resilience ADK custom tools."""

from __future__ import annotations

import unittest
from typing import Any
from unittest.mock import MagicMock

from agent.config import AgentConfig
from agent.tests.model_fixtures import model_metadata
from agent.tools import (
    HeatResilienceRuntime,
    audit_recommendations_equity,
    format_feature_attributions,
    get_runtime,
    get_station_heat_frequency,
    predict_and_explain_location,
    rank_cooling_sites,
    set_runtime,
)


class FakeRow(dict):
    """Emulates `google.cloud.bigquery.table.Row` mapping interface."""


class FakeQueryJob:
    """Emulates a BigQuery QueryJob returning an iterable of `FakeRow` objects."""

    job_id = "offline-test-job"
    total_bytes_billed = 0

    def __init__(self, rows: list[dict[str, Any]]):
        self._rows = [FakeRow(r) for r in rows]

    def result(self, timeout: float | None = None) -> list[FakeRow]:
        return self._rows


class TestUrbanHeatTools(unittest.TestCase):
    """Verify all four ADK custom function tools and edge cases."""

    def setUp(self) -> None:
        self.addCleanup(set_runtime, get_runtime())
        self.mock_client = MagicMock()
        self.mock_client.get_model.side_effect = model_metadata
        self.mock_client.project = "test-a4i-project"
        self.config = AgentConfig(
            project_id="test-a4i-project",
            dataset_id="a4i_climate",
            location="US",
            bqml_model_name="heat_offset_model",
            bbox_pad_degrees=0.03,
            explain_top_k=4,
            auto_bootstrap_bqml=True,
        )
        self.runtime = HeatResilienceRuntime(config=self.config, client=self.mock_client)
        set_runtime(self.runtime)

        # Default city metadata row (Dallas bounding box)
        self.city_meta_row = {
            "city": "Dallas",
            "total_observations": 19120,
            "city_avg_temp_f": 96.4,
            "city_min_temp_f": 89.2,
            "city_max_temp_f": 105.8,
            "min_lat": 32.6200,
            "max_lat": 32.9900,
            "min_lon": -96.9900,
            "max_lon": -96.6100,
        }

    def test_format_feature_attributions_orders_and_labels_associations(self) -> None:
        raw_attrs = [
            {"feature": "median_income", "attribution": -0.64},
            {"feature": "structure_age_years", "attribution": 3.82},
            {"feature": "no_vehicle_rate", "attribution": 1.91},
        ]
        structured, narrative = format_feature_attributions(raw_attrs)

        self.assertEqual(len(structured), 3)
        self.assertEqual(structured[0]["feature"], "structure_age_years")
        self.assertEqual(structured[0]["attribution_f"], 3.82)
        self.assertEqual(structured[0]["direction"], "increases_prediction")
        self.assertEqual(structured[2]["feature"], "median_income")
        self.assertEqual(structured[2]["direction"], "decreases_prediction")
        self.assertIn("+3.82\u00b0F model contribution associated with older building stock & urban form", narrative)
        self.assertIn("+1.91\u00b0F model contribution associated with household transit/walking dependency", narrative)
        self.assertIn("\u22120.64\u00b0F model contribution associated with median household income", narrative)
        self.assertIn("not causal heat effects", narrative)

    def test_zero_attribution_is_neutral_not_a_warming_cause(self) -> None:
        structured, narrative = format_feature_attributions([
            {"feature": "no_vehicle_rate", "attribution": 0.0},
        ])
        self.assertEqual(structured[0]["direction"], "neutral")
        self.assertIn("not causal heat effects", narrative)

    def test_predict_and_explain_location_refuses_out_of_bounds(self) -> None:
        # First query returns Dallas bounding box
        self.mock_client.query.return_value = FakeQueryJob([self.city_meta_row])

        # Phoenix, AZ coordinates -> well outside Dallas bounding box
        result = predict_and_explain_location(latitude=33.4484, longitude=-112.0740)

        self.assertEqual(result["status"], "ERROR")
        self.assertEqual(result["category"], "OUT_OF_BOUNDS")
        self.assertEqual(result["error_code"], "LOCATION_OUTSIDE_CAMPAIGN_BOUNDS")
        self.assertEqual(result["loaded_city"], "Dallas")
        self.assertIn("REFUSE PREDICTION", result["refusal_instruction"])
        # Ensure we only queried city metadata and did NOT execute ML.EXPLAIN_PREDICT
        self.assertEqual(self.mock_client.query.call_count, 1)

    def test_predict_and_explain_location_returns_bqml_explanation_in_bounds(self) -> None:
        explain_row = {
            "predicted_heat_offset_f": 6.45,
            "baseline_prediction_value": 0.12,
            "top_feature_attributions": [
                {"feature": "structure_age_years", "attribution": 3.80},
                {"feature": "no_vehicle_rate", "attribution": 1.90},
                {"feature": "poverty_rate", "attribution": 0.75},
            ],
            "primary_geo_id": "48113004900",
            "primary_tract_dist_m": 240.5,
            "total_pop": 4820.0,
            "median_age": 38.4,
            "median_income": 34200.0,
            "poverty_rate": 0.284,
            "no_vehicle_rate": 0.192,
            "median_year_structure_built": 1964.0,
            "readings_within_500m": 0,
            "nearest_reading_dist_m": 845.0,
            "avg_temp_within_500m_f": None,
        }
        self.mock_client.query.side_effect = [
            FakeQueryJob([self.city_meta_row]),
            FakeQueryJob([explain_row]),
        ]

        result = predict_and_explain_location(latitude=32.7485, longitude=-96.8183)

        self.assertEqual(result["status"], "OK")
        self.assertEqual(result["city"], "Dallas")
        self.assertAlmostEqual(result["predicted_heat_offset_f"], 6.45)
        self.assertIn("+6.45\u00b0F", result["formatted_offset"])
        self.assertIn("+3.80\u00b0F model contribution associated with older building stock", result["explanation_summary"])
        self.assertEqual(result["nearest_tract_context"]["tract_geo_id"], "48113004900")
        self.assertEqual(result["nearest_tract_context"]["no_vehicle_rate_pct"], 19.2)
        self.assertFalse(result["nearby_observed_readings"]["was_directly_measured_within_500m"])

    def test_rank_cooling_sites_returns_ranked_recommendations_and_tract_ids(self) -> None:
        ranked_rows = [
            {
                "geo_id": "48113004900",
                "latitude": 32.7485,
                "longitude": -96.8183,
                "composite_priority_score": 92.4,
                "predicted_heat_offset_f": 7.12,
                "top_feature_attributions": [
                    {"feature": "no_vehicle_rate", "attribution": 3.10},
                    {"feature": "structure_age_years", "attribution": 2.45},
                ],
                "total_pop": 5120.0,
                "poverty_rate": 0.315,
                "no_vehicle_rate": 0.224,
                "no_cars": 390.0,
                "median_age": 41.2,
                "median_income": 31500.0,
                "median_year_structure_built": 1961.0,
            },
            {
                "geo_id": "48113008900",
                "latitude": 32.7621,
                "longitude": -96.7654,
                "composite_priority_score": 86.7,
                "predicted_heat_offset_f": 6.35,
                "top_feature_attributions": [
                    {"feature": "housing_units", "attribution": 2.80},
                    {"feature": "poverty_rate", "attribution": 1.65},
                ],
                "total_pop": 4390.0,
                "poverty_rate": 0.278,
                "no_vehicle_rate": 0.168,
                "no_cars": 280.0,
                "median_age": 37.9,
                "median_income": 36800.0,
                "median_year_structure_built": 1969.0,
            },
        ]
        self.mock_client.query.side_effect = [
            FakeQueryJob([self.city_meta_row]),
            FakeQueryJob(ranked_rows),
        ]

        result = rank_cooling_sites(top_n=2, mode="budget_cycle")

        self.assertEqual(result["status"], "OK")
        self.assertEqual(result["mode"], "budget_cycle")
        self.assertEqual(result["recommended_tract_ids"], ["48113004900", "48113008900"])
        self.assertEqual(len(result["sites"]), 2)
        self.assertEqual(result["sites"][0]["rank"], 1)
        self.assertAlmostEqual(result["sites"][0]["predicted_heat_offset_f"], 7.12)
        self.assertIn("permanent neighborhood cooling center", result["sites"][0]["recommended_intervention"])

    def test_audit_recommendations_equity_computes_deltas_and_verdict(self) -> None:
        audit_row = {
            "rec_tract_count": 2,
            "incomplete_recommended_count": 0,
            "incomplete_baseline_count": 0,
            "matched_tract_ids": ["06037206020", "06037206031"],
            "rec_total_pop": 9510.0,
            "rec_avg_poverty_rate": 0.296,
            "rec_avg_no_vehicle_rate": 0.196,
            "rec_avg_median_age": 39.5,
            "rec_avg_median_income": 34150.0,
            "rec_total_no_car_households": 670.0,
            "city_tract_count": 312,
            "city_total_pop": 1304000.0,
            "city_avg_poverty_rate": 0.172,
            "city_avg_no_vehicle_rate": 0.084,
            "city_avg_median_age": 34.1,
            "city_avg_median_income": 65400.0,
        }
        self.mock_client.query.side_effect = [
            FakeQueryJob([self.city_meta_row]),
            FakeQueryJob([audit_row]),
        ]

        # Pass 10-digit California tract IDs to test LPAD / zero-padding normalization
        result = audit_recommendations_equity(tract_ids=["6037206020", "06037206031"])

        self.assertEqual(result["status"], "OK")
        self.assertEqual(
            result["equity_verdict"]["classification"],
            "STRONG_VULNERABILITY_ALIGNMENT",
        )
        deltas = result["equity_deltas_vs_city_average"]
        self.assertAlmostEqual(deltas["poverty_rate_delta_pct_points"], 12.4, places=1)
        self.assertAlmostEqual(deltas["no_vehicle_rate_delta_pct_points"], 11.2, places=1)
        self.assertLess(deltas["median_income_delta_usd"], -30000)

    def test_get_station_heat_frequency_computes_multi_year_trend(self) -> None:
        yearly_rows = [
            {
                "obs_year": 2021,
                "observed_days": 365,
                "days_avg_ge_threshold": 38,
                "days_peak_ge_threshold": 44,
                "days_ge_90f": 88,
                "days_ge_95f": 38,
                "days_ge_100f": 11,
                "summer_mean_max_f": 94.8,
                "annual_peak_temp_f": 104.0,
                "total_stations": 4,
                "station_names": ["DALLAS LOVE FIELD", "DALLAS EXEC AP"],
                "first_date": "2019-01-01",
                "last_date": "2025-09-30",
            },
            {
                "obs_year": 2022,
                "observed_days": 365,
                "days_avg_ge_threshold": 54,
                "days_peak_ge_threshold": 60,
                "days_ge_90f": 102,
                "days_ge_95f": 54,
                "days_ge_100f": 24,
                "summer_mean_max_f": 97.6,
                "annual_peak_temp_f": 107.1,
                "total_stations": 4,
                "station_names": ["DALLAS LOVE FIELD", "DALLAS EXEC AP"],
                "first_date": "2019-01-01",
                "last_date": "2025-09-30",
            },
            {
                "obs_year": 2023,
                "observed_days": 365,
                "days_avg_ge_threshold": 62,
                "days_peak_ge_threshold": 68,
                "days_ge_90f": 108,
                "days_ge_95f": 62,
                "days_ge_100f": 33,
                "summer_mean_max_f": 98.9,
                "annual_peak_temp_f": 109.0,
                "total_stations": 4,
                "station_names": ["DALLAS LOVE FIELD", "DALLAS EXEC AP"],
                "first_date": "2019-01-01",
                "last_date": "2025-09-30",
            },
            {
                "obs_year": 2024,
                "observed_days": 366,
                "days_avg_ge_threshold": 58,
                "days_peak_ge_threshold": 63,
                "days_ge_90f": 104,
                "days_ge_95f": 58,
                "days_ge_100f": 25,
                "summer_mean_max_f": 97.9,
                "annual_peak_temp_f": 106.5,
                "total_stations": 4,
                "station_names": ["DALLAS LOVE FIELD", "DALLAS EXEC AP"],
                "first_date": "2019-01-01",
                "last_date": "2025-09-30",
            },
        ]
        self.mock_client.query.side_effect = [
            FakeQueryJob([self.city_meta_row]),
            FakeQueryJob(yearly_rows),
        ]

        result = get_station_heat_frequency(threshold_f=95.0)

        self.assertEqual(result["status"], "OK")
        self.assertEqual(result["city"], "Dallas")
        self.assertEqual(result["trend_analysis"]["direction"], "INCREASING")
        self.assertGreater(result["trend_analysis"]["slope_hot_days_per_year"], 5.0)
        self.assertEqual(result["multi_year_summary"]["all_time_record_max_f_in_window"], 109.0)


if __name__ == "__main__":
    unittest.main()
