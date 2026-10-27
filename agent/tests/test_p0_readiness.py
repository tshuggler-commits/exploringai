"""Model routing, contract, failure taxonomy, and no-fabricated-evidence tests."""

import inspect
import unittest
from dataclasses import replace
from unittest.mock import MagicMock, patch

from google.adk.tools import FunctionTool
from google.api_core.exceptions import BadRequest, DeadlineExceeded, Forbidden, NotFound
from google.cloud.bigquery import Model

from agent import planning_tools, tools
from agent.agent import build_agent
from agent.config import AgentConfig
from agent.contracts import (
    MODEL_FEATURES, ToolFailure, exception_result, explained_features,
    required_number, validate_model_metadata,
)
from agent.tests.model_fixtures import model_metadata, sql_field
from agent.validate_models import check_family


class TestP0Readiness(unittest.TestCase):
    def setUp(self) -> None:
        self.addCleanup(tools.set_runtime, tools.get_runtime())
        self.client = MagicMock()
        self.client.get_model.side_effect = model_metadata
        self.config = AgentConfig(project_id="test-project", mcp_toolbox_url=None)
        self.runtime = tools.HeatResilienceRuntime(self.config, self.client)
        self.runtime._city_meta = planning_tools.CityCampaignMetadata(
            "Atlanta", 100, 95, 90, 100, 33.6, 33.9, -84.5, -84.2,
        )
        tools.set_runtime(self.runtime)

    def test_exact_numeric_model_contracts(self) -> None:
        for family, resource in (
            ("atlanta", "p.d.heat_offset_model"),
            ("planning", "p.d.heat_planning_model"),
        ):
            model = model_metadata(resource)
            report = validate_model_metadata(model, family, resource)
            self.assertEqual(set(report["features"]), MODEL_FEATURES[family])
            self.assertEqual(report["model_family"], family)
            self.assertEqual(report["model_etag"], "test-model-etag")

    def test_real_bigquery_metadata_resource_shape(self) -> None:
        model = Model.from_api_repr({
            "modelReference": {"projectId": "p", "datasetId": "d", "modelId": "m"},
            "modelType": "LINEAR_REGRESSION", "etag": "live-shaped-etag",
            "featureColumns": [
                {"name": name, "type": {"typeKind": "FLOAT64"}}
                for name in MODEL_FEATURES["atlanta"]
            ],
            "labelColumns": [{"name": "predicted_offset_f", "type": {"typeKind": "FLOAT64"}}],
        })
        result = validate_model_metadata(model, "atlanta", "p.d.m")
        self.assertEqual(result["label"], {"predicted_offset_f": "FLOAT64"})
        self.assertEqual(result["model_etag"], "live-shaped-etag")

    def test_wrong_features_label_types_and_model_kind_fail_closed(self) -> None:
        cases = [
            {"feature_columns": [sql_field("temperature")]},
            {"label_columns": [sql_field("heat_offset_f")]},
            {"feature_columns": [
                sql_field(name, "STRING" if name == "latitude" else "FLOAT64")
                for name in MODEL_FEATURES["atlanta"]
            ]},
            {"label_columns": [sql_field("offset_f", "STRING")]},
            {"model_type": "BOOSTED_TREE_REGRESSOR"},
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                model = model_metadata("p.d.heat_offset_model")
                for key, value in changes.items():
                    setattr(model, key, value)
                self.client.get_model.side_effect = None
                self.client.get_model.return_value = model
                with self.assertLogs("agent.contracts", level="WARNING"):
                    result = tools.rank_cooling_center_sites(1)
                self.assertEqual(result["category"], "CONTRACT")
                self.assertEqual(result["error_code"], "MODEL_CONTRACT_MISMATCH")
        self.client.query.assert_not_called()

    def test_metadata_is_rechecked_after_promotion(self) -> None:
        valid = model_metadata("p.d.heat_offset_model")
        incompatible = model_metadata("p.d.heat_offset_model")
        incompatible.label_columns = [sql_field("wrong_label")]
        self.client.get_model.side_effect = [valid, incompatible]
        self.runtime.validate_model("atlanta")
        with self.assertRaises(ToolFailure):
            self.runtime.validate_model("atlanta")
        self.assertEqual(self.client.get_model.call_count, 2)

    def test_atlanta_and_planning_have_disjoint_adk_tool_schemas(self) -> None:
        sets = {}
        for family, count in (("atlanta", 9), ("planning", 4)):
            agent = build_agent(replace(self.config, model_family=family))
            sets[family] = {tool.__name__ for tool in agent.tools}
            self.assertEqual(len(agent.tools), count)
            self.assertIn(f"ACTIVE MODEL FAMILY: {family}", agent.instruction)
            for tool in agent.tools:
                declaration = FunctionTool(tool)._get_declaration()
                if declaration.parameters_json_schema:
                    properties = declaration.parameters_json_schema.get("properties", {})
                else:
                    properties = declaration.parameters.properties or {}
                self.assertNotIn("model_name", properties)
                self.assertNotIn("tool_context", properties)
                self.assertNotIn("model_name", inspect.signature(tool).parameters)
        self.assertFalse(sets["atlanta"] & sets["planning"])
        self.client.query.assert_not_called()
        self.client.get_model.assert_not_called()

    def test_llm_cannot_override_the_configured_model(self) -> None:
        tool = next(t for t in build_agent(self.config).tools if t.__name__ == "rank_cooling_center_sites")
        result = tool(model_name="heat_planning_model")
        self.assertEqual(result["error_code"], "MODEL_OVERRIDE_DISABLED")
        self.client.query.assert_not_called()

    def test_existing_agents_keep_their_runtime_after_another_agent_is_built(self) -> None:
        with patch("agent.agent.HeatResilienceRuntime", return_value=self.runtime):
            first = build_agent(self.config)
        other_client = MagicMock()
        other_runtime = tools.HeatResilienceRuntime(
            replace(self.config, project_id="other-project", model_family="planning"),
            other_client,
        )
        tools.set_runtime(other_runtime)
        build_agent(other_runtime.config)
        self.client.query.return_value.result.return_value = []
        demographics = next(t for t in first.tools if t.__name__ == "get_tract_demographics")
        with self.assertLogs(level="WARNING"):
            result = demographics(tract_id="13121006802")
        self.assertEqual(result["status"], "ERROR")
        self.assertIn("test-project", self.client.query.call_args.args[0])
        other_client.query.assert_not_called()
        self.assertIs(tools.get_runtime(), other_runtime)

    def test_invalid_family_is_rejected_and_bootstrap_defaults_off(self) -> None:
        self.assertFalse(self.config.auto_bootstrap_bqml)
        with self.assertRaisesRegex(ValueError, "MODEL_FAMILY"):
            replace(self.config, model_family="mixed")

    def test_failure_taxonomy_and_no_cloud_details_in_public_errors(self) -> None:
        for error, category, code in (
            (Forbidden("sensitive cloud detail"), "PERMISSION", "PERMISSION_DENIED"),
            (NotFound("resource"), "NO_DATA", "RESOURCE_NOT_FOUND"),
            (TimeoutError("timeout"), "TIMEOUT", "QUERY_TIMEOUT"),
            (DeadlineExceeded("deadline"), "TIMEOUT", "QUERY_TIMEOUT"),
            (BadRequest("invalid SQL"), "QUERY", "QUERY_REJECTED"),
            (RuntimeError("sensitive internal detail"), "INTERNAL", "INTERNAL_ERROR"),
        ):
            with self.subTest(error=type(error).__name__):
                result = exception_result(error)
                self.assertEqual(result["status"], "ERROR")
                self.assertEqual(result["category"], category)
                self.assertEqual(result["error_code"], code)
                self.assertEqual(result["error"], result["message"])
                self.assertNotIn("sensitive", result["message"])

    def test_cloud_failures_are_consistent_across_all_thirteen_tools(self) -> None:
        cases = [
            lambda: tools.predict_heat_offset_and_explain(33.75, -84.39),
            lambda: tools.compare_locations_and_explain(33.75, -84.39, "A", 33.76, -84.4, "B"),
            lambda: tools.compare_census_tracts("13121006802", "13121007808"),
            lambda: tools.rank_cooling_center_sites(),
            lambda: tools.query_heat_history(),
            lambda: tools.get_tract_demographics(tract_id="13121006802"),
            lambda: tools.audit_equity(["13121006802"]),
            lambda: tools.recommend_canopy_interventions(),
            lambda: tools.generate_council_proposal(),
            lambda: tools.predict_and_explain_location(33.75, -84.39),
            lambda: tools.rank_cooling_sites(),
            lambda: tools.audit_recommendations_equity(["13121006802"]),
            lambda: tools.get_station_heat_frequency(),
        ]
        for error, category in ((Forbidden("denied"), "PERMISSION"), (TimeoutError(), "TIMEOUT")):
            self.client.query.side_effect = error
            for call in cases:
                with self.subTest(category=category, call=call):
                    with self.assertLogs(level="WARNING"):
                        result = call()
                    self.assertEqual(result["status"], "ERROR")
                    self.assertEqual(result["category"], category)
                    self.assertIsInstance(result["retryable"], bool)
                    self.assertNotIn("ranked_sites", result)

    def test_missing_metadata_permission_never_attempts_inference_or_training(self) -> None:
        self.client.get_model.side_effect = Forbidden("denied")
        for call in (
            lambda: tools.predict_heat_offset_and_explain(33.75, -84.39),
            lambda: tools.rank_cooling_sites(1),
        ):
            with self.assertLogs(level="WARNING"):
                result = call()
            self.assertEqual(result["category"], "PERMISSION")
        self.client.query.assert_not_called()

    def test_empty_rankings_are_not_success(self) -> None:
        self.client.query.return_value.result.return_value = []
        for call in (tools.rank_cooling_center_sites, tools.rank_cooling_sites):
            with self.assertLogs(level="WARNING"):
                result = call()
            self.assertEqual(result["status"], "ERROR")
            self.assertEqual(result["category"], "NO_DATA")

    def test_missing_or_nonfinite_predictions_and_explanations_are_not_zero(self) -> None:
        for row in ({}, {"x": None}, {"x": float("nan")}, {"x": float("inf")}, {"x": True}, {"x": "3"}):
            with self.subTest(row=row), self.assertRaises(ToolFailure):
                required_number(row, "x")
        self.assertEqual(required_number({"x": 0}, "x"), 0)
        for attrs in ([], [{"feature": "latitude"}], [{"feature": "canopy", "attribution": 1}]):
            with self.subTest(attrs=attrs), self.assertRaises(ToolFailure):
                explained_features(attrs, "atlanta")
        with self.assertRaises(ToolFailure):
            planning_tools._extract_predicted_offset({"predicted_other_label": 42})

    def test_partial_or_null_equity_data_never_produces_a_verdict(self) -> None:
        for row in (
            {"rec_tract_count": 1, "matched_tract_ids": ["13121006802"]},
            {"rec_tract_count": 2, "matched_tract_ids": ["13121006802", "13121007808"],
             "incomplete_recommended_count": 1, "incomplete_baseline_count": 0},
            {"rec_tract_count": 2, "matched_tract_ids": ["13121006802", "13121007808"],
             "incomplete_recommended_count": 0, "incomplete_baseline_count": 0},
        ):
            self.client.query.return_value.result.return_value = [row]
            with self.assertLogs(level="WARNING"):
                result = tools.audit_recommendations_equity(["13121006802", "13121007808"])
            self.assertEqual(result["category"], "NO_DATA")
            self.assertNotIn("equity_verdict", result)

    def test_one_year_cannot_claim_a_stable_trend(self) -> None:
        row = dict(obs_year=2025, observed_days=365, days_avg_ge_threshold=0,
                   days_peak_ge_threshold=0, days_ge_90f=0, days_ge_95f=0,
                   days_ge_100f=0, annual_peak_temp_f=80, total_stations=1,
                   station_names=["Test"], first_date="2025-01-01", last_date="2025-12-31")
        self.client.query.return_value.result.return_value = [row]
        result = tools.get_station_heat_frequency()
        self.assertEqual(result["status"], "OK")
        self.assertEqual(result["trend_analysis"]["direction"], "INSUFFICIENT_HISTORY")
        self.assertIsNone(result["trend_analysis"]["slope_hot_days_per_year"])
        self.assertEqual(result["multi_year_summary"]["avg_annual_days_95f_plus"], 0)
        row["observed_days"] = 20
        with self.assertLogs(level="WARNING"):
            result = tools.get_station_heat_frequency()
        self.assertEqual(result["error_code"], "INSUFFICIENT_HISTORY")

    def test_live_check_is_read_only_and_permission_failure_is_not_a_pass(self) -> None:
        with patch("agent.validate_models.HeatResilienceRuntime", return_value=self.runtime):
            self.client.get_model.side_effect = Forbidden("denied")
            with self.assertLogs(level="ERROR"):
                result = check_family(self.config, "atlanta", execute=True)
        self.assertEqual(result["error_code"], "PERMISSION_DENIED")
        self.client.query.assert_not_called()
        self.assertIs(tools.get_runtime(), self.runtime)

    def test_live_cli_check_runs_prediction_and_explained_ranking_only(self) -> None:
        with patch("agent.validate_models.HeatResilienceRuntime", return_value=self.runtime), \
             patch("agent.validate_models.predict_heat_offset_and_explain", return_value={"status": "OK"}) as predict, \
             patch("agent.validate_models.rank_cooling_center_sites", return_value={"status": "OK"}) as rank:
            result = check_family(self.config, "atlanta", execute=True)
        self.assertEqual(result["status"], "OK")
        predict.assert_called_once_with(33.7537, -84.3902, baseline_forecast_f=None)
        rank.assert_called_once_with(1)
        self.client.query.assert_not_called()

    def test_missing_arguments_are_input_errors_not_internal_errors(self) -> None:
        with self.assertLogs("agent.contracts", level="WARNING"):
            result = tools.compare_census_tracts()
        self.assertEqual(result["category"], "INVALID_INPUT")
        self.assertEqual(result["error_code"], "INVALID_ARGUMENTS")
