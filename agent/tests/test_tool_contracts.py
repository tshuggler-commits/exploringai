"""Offline regression tests for the data-lane serving and execution contracts."""

import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from google.api_core.exceptions import BadRequest

from agent import tools
from agent.config import AgentConfig
from agent.tests.model_fixtures import model_metadata


class TestToolContracts(unittest.TestCase):
    def setUp(self) -> None:
        self.addCleanup(tools.set_runtime, tools.get_runtime())
        self.client = MagicMock()
        self.client.get_model.side_effect = model_metadata
        self.config = AgentConfig(project_id="test-project")
        self.runtime = tools.HeatResilienceRuntime(self.config, self.client)
        tools.set_runtime(self.runtime)

    def test_query_limits_apply_to_parameterized_jobs(self) -> None:
        config = tools.bigquery.QueryJobConfig(query_parameters=[
            tools.bigquery.ScalarQueryParameter("value", "INT64", 1),
        ])
        self.client.query.return_value.result.return_value = [{"value": 1}]

        self.assertEqual(self.runtime.query_rows("SELECT @value", config), [{"value": 1}])
        self.assertEqual(config.maximum_bytes_billed, 1_000_000_000)
        self.assertEqual(int(config.job_timeout_ms), 60_000)
        self.assertEqual(config.query_parameters[0].value, 1)
        self.assertEqual(self.client.query.call_args.kwargs["timeout"], 60)
        self.client.query.return_value.result.assert_called_once_with(timeout=60)

    def test_timeout_cancels_job_and_propagates(self) -> None:
        job = self.client.query.return_value
        job.result.side_effect = TimeoutError("deadline")
        with self.assertLogs("agent.telemetry", level="ERROR"):
            with self.assertRaises(TimeoutError):
                self.runtime.query_rows("SELECT 1")
        job.cancel.assert_called_once()
        self.client.query.assert_called_once()

    def test_query_failure_is_logged_and_not_retried(self) -> None:
        self.client.query.side_effect = BadRequest("invalid SQL")
        with self.assertLogs("agent.telemetry", level="ERROR"):
            with self.assertRaises(BadRequest):
                self.runtime.query_rows("invalid")
        self.client.query.assert_called_once()

    def test_cancellation_failure_preserves_original_timeout(self) -> None:
        job = self.client.query.return_value
        job.result.side_effect = TimeoutError("original deadline")
        job.cancel.side_effect = BadRequest("cannot cancel")
        with self.assertLogs("agent.telemetry", level="ERROR"):
            with self.assertRaisesRegex(TimeoutError, "original deadline"):
                self.runtime.query_rows("SELECT 1")

    def test_invalid_configuration_rejects_sql_identifiers_and_unbounded_queries(self) -> None:
        for kwargs in (
            {"dataset_id": "dataset`"},
            {"bqml_model_name": "model; DROP MODEL x"},
            {"planning_bqml_model_name": "project.dataset.model"},
            {"project_id": "project`"},
            {"query_timeout_seconds": 0},
            {"maximum_bytes_billed": -1},
            {"maximum_bytes_billed": True},
        ):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                AgentConfig(**kwargs)

    def test_invalid_tool_inputs_never_query(self) -> None:
        cases = [
            lambda: tools.predict_heat_offset_and_explain(float("nan"), -84.39),
            lambda: tools.predict_heat_offset_and_explain(True, -84.39),
            lambda: tools.predict_heat_offset_and_explain(33.75, float("inf")),
            lambda: tools.predict_heat_offset_and_explain(32.75, -96.81),
            lambda: tools.predict_heat_offset_and_explain(tract_id="123"),
            lambda: tools.predict_heat_offset_and_explain(33.75, -84.39, baseline_forecast_f=float("nan")),
            lambda: tools.rank_cooling_center_sites(top_n=0),
            lambda: tools.rank_cooling_center_sites(top_n=21),
            lambda: tools.rank_cooling_center_sites(top_n=True),
            lambda: tools.rank_cooling_center_sites(focus_criteria="unknown"),
            lambda: tools.query_heat_history(min_temp_f=float("inf")),
            lambda: tools.query_heat_history(start_year=9999),
            lambda: tools.get_tract_demographics(latitude=90, longitude=0),
            lambda: tools.audit_equity(["123' OR TRUE --"]),
            lambda: tools.audit_equity([]),
            lambda: tools.compare_locations_and_explain(33.75, -84.39, "A", 0, 0, "B"),
            lambda: tools.compare_census_tracts("13121006802", "bad-id"),
        ]
        with self.assertLogs("agent.tools", level="WARNING"):
            for case in cases:
                with self.subTest(case=case):
                    result = case()
                    self.assertEqual(result["status"], "ERROR")
                    self.assertIn("error_code", result)
                    self.assertIn("error", result)
        self.client.query.assert_not_called()

    def test_planning_tools_validate_before_metadata_or_prediction(self) -> None:
        cases = [
            lambda: tools.predict_and_explain_location(True, -84.39),
            lambda: tools.get_station_heat_frequency(True),
            lambda: tools.rank_cooling_sites(top_n=21),
            lambda: tools.rank_cooling_sites(top_n=False),
            lambda: tools.rank_cooling_sites(mode="typo"),
            lambda: tools.rank_cooling_sites(mode=None),
            lambda: tools.audit_recommendations_equity(["bad-id"]),
            lambda: tools.audit_recommendations_equity(["13121006802"] * 101),
        ]
        for case in cases:
            with self.subTest(case=case):
                result = case()
                self.assertEqual(result["status"], "ERROR")
                self.assertEqual(result["category"], "INVALID_INPUT")
                self.assertIn("error_code", result)
        self.client.query.assert_not_called()

    def test_prediction_uses_data_lane_preprocessing_and_provenance(self) -> None:
        row = SimpleNamespace(
            predicted_offset_f=3.25, top_feature_attributions=[{"feature": "latitude", "attribution": 0.25}],
            geo_id="13121006802", total_pop=4200, poverty_rate=0.25,
            no_vehicle_rate=0.2, median_age=38, median_year_structure_built=1960,
        )
        self.client.query.return_value.result.return_value = [row]

        result = tools.predict_heat_offset_and_explain(33.75, -84.39, baseline_forecast_f=100)

        self.assertEqual(result["predicted_surface_temp_f"], 103.25)
        self.assertEqual(result["status"], "OK")
        self.assertEqual(result["provenance"]["model"], "test-project.a4i_climate.heat_offset_model")
        sql = self.client.query.call_args.args[0]
        self.assertIn("median_income >= 0", sql)
        self.assertIn("poverty_rate BETWEEN 0 AND 1", sql)
        self.assertIn("EXTRACT(YEAR FROM @reference_time)", sql)
        self.assertIn("WHERE @tract_id IS NULL OR geo_id = @tract_id", sql)
        self.assertIn("LEFT JOIN canopy", sql)
        model_inputs = sql.split("ML.EXPLAIN_PREDICT", 1)[1].split("STRUCT(3", 1)[0]
        self.assertNotIn("tree_canopy_pct", model_inputs)
        self.client.get_model.assert_called_once()

    def test_ranking_uses_same_cleaning_and_honors_focus(self) -> None:
        self.client.query.return_value.result.return_value = []
        for focus, order in (
            ("pure_heat", "offset_f"),
            ("vulnerability_and_heat", "composite_vulnerability_score"),
        ):
            with self.subTest(focus=focus):
                tools.rank_cooling_center_sites(top_n=3, focus_criteria=focus)
                sql = self.client.query.call_args.args[0]
                self.assertIn(f"ORDER BY {order} DESC, geo_id", sql)
                self.assertIn("LIMIT @top_n", sql)
                self.assertIn("t.geo_id = p.geo_id", sql)
                self.assertIn("median_income >= 0", sql)
                params = self.client.query.call_args.kwargs["job_config"].query_parameters
                self.assertEqual(params[0].value, 3)

    def test_comparison_propagates_failure_without_key_error(self) -> None:
        with patch.object(tools, "predict_heat_offset_and_explain", return_value={"error": "no data"}) as predict:
            with self.assertLogs("agent.contracts", level="WARNING"):
                result = tools.compare_locations_and_explain(33.75, -84.39, "A", 33.76, -84.4, "B")
        self.assertEqual(result["error_code"], "TOOL_FAILED")
        predict.assert_called_once()

    def test_comparison_propagates_second_site_failure(self) -> None:
        with patch.object(tools, "predict_heat_offset_and_explain", side_effect=[
            {"predicted_heat_offset_f": 1.0}, {"error": "no data"},
        ]):
            with self.assertLogs("agent.contracts", level="WARNING"):
                result = tools.compare_locations_and_explain(33.75, -84.39, "A", 33.76, -84.4, "B")
        self.assertEqual(result["error_code"], "TOOL_FAILED")

    def test_prediction_null_baseline_preserves_offset_without_absolute_temperature(self) -> None:
        row = SimpleNamespace(
            predicted_offset_f=-1.25, top_feature_attributions=[{"feature": "latitude", "attribution": -0.25}],
            geo_id="13121006802", total_pop=4200, poverty_rate=0.25,
            no_vehicle_rate=0.2, median_age=38, median_year_structure_built=1960,
        )
        self.client.query.return_value.result.return_value = [row]
        result = tools.predict_heat_offset_and_explain(33.75, -84.39, baseline_forecast_f=None)
        self.assertEqual(result["predicted_heat_offset_f"], -1.25)
        self.assertIsNone(result["predicted_surface_temp_f"])

    def test_history_includes_zero_exceedance_years_and_full_summer_average(self) -> None:
        self.client.query.return_value.result.return_value = []
        tools.query_heat_history(95, 2020)
        sql = self.client.query.call_args.args[0]
        self.assertIn("COUNT(DISTINCT IF(max_temp_f >= @min_temp_f", sql)
        self.assertIn("EXTRACT(MONTH FROM observation_date) IN (6, 7, 8)", sql)
        self.assertNotIn("WHERE max_temp_f >=", sql)
        params = self.client.query.call_args.kwargs["job_config"].query_parameters
        self.assertEqual([p.value for p in params], [95, 2020])

    def test_equity_deduplicates_and_rejects_partial_matches(self) -> None:
        self.client.query.return_value.result.return_value = [SimpleNamespace(matched_tract_count=1)]
        with self.assertLogs("agent.tools", level="WARNING"):
            result = tools.audit_equity(["13121006802", "13121006802", "13121007808"])
        self.assertEqual(result["error_code"], "TRACTS_NOT_FOUND")
        sql = self.client.query.call_args.args[0]
        self.assertIn("IN UNNEST(@tract_ids)", sql)
        self.assertNotIn("13121006802", sql)
        params = self.client.query.call_args.kwargs["job_config"].query_parameters
        self.assertEqual(list(params[0].values), ["13121006802", "13121007808"])

    def test_cleaning_template_has_no_unresolved_resource_placeholder(self) -> None:
        sql = tools._clean_tracts_sql()
        self.assertNotIn("{{", sql)
        self.assertIn("test-project.a4i_climate.tract_demographics", sql)
        self.assertTrue(Path(tools.__file__).with_name("sql").joinpath("clean_tracts.sql").is_file())
