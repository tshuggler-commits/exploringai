"""Verify the merged Atlanta and extended planning agent surfaces."""

import unittest
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from google.api_core.exceptions import NotFound

from agent import planning_tools, tools
from agent.agent import build_agent
from agent.config import AgentConfig
from agent.contracts import ToolFailure
from agent.tests.model_fixtures import model_metadata


class TestMergedAgent(unittest.TestCase):
    def setUp(self) -> None:
        self.addCleanup(tools.set_runtime, tools.get_runtime())
        self.config = AgentConfig(
            project_id="test-project",
            dataset_id="test_climate",
            bqml_model_name="atlanta_offset",
            planning_bqml_model_name="planning_offset",
            gemini_model="gemini-2.5-flash",
            mcp_toolbox_url=None,
        )
        self.client = MagicMock()
        self.client.get_model.side_effect = model_metadata
        self.runtime = tools.HeatResilienceRuntime(config=self.config, client=self.client)
        tools.set_runtime(self.runtime)

    def test_build_registers_only_atlanta_tools_and_preserves_identity(self) -> None:
        agent = build_agent(self.config)

        self.assertEqual(agent.name, "atlanta_heat_resilience_advisor")
        self.assertEqual(agent.model, self.config.gemini_model)
        self.assertEqual(
            {tool.__name__ for tool in agent.tools},
            {
                "predict_heat_offset_and_explain",
                "compare_locations_and_explain",
                "compare_census_tracts",
                "rank_cooling_center_sites",
                "query_heat_history",
                "get_tract_demographics",
                "audit_equity",
                "recommend_canopy_interventions",
                "generate_council_proposal",
            },
        )
        self.assertIn("strictly scoped to the City of Atlanta", agent.instruction)
        self.assertIn("Never blend or directly compare predictions", agent.instruction)
        self.assertIn("Economic tract features may still be prediction inputs", agent.instruction)
        self.assertIn("predictive associations rather than causal proof", agent.instruction)
        self.client.query.assert_not_called()

    def test_build_with_configuration_does_not_create_bigquery_client(self) -> None:
        with patch.object(planning_tools.bigquery, "Client") as factory:
            agent = build_agent(self.config)

        factory.assert_not_called()
        self.assertIs(tools.get_runtime().config, self.config)
        self.assertEqual(agent.model, self.config.gemini_model)

    def test_atlanta_prediction_retains_model_and_response_schema(self) -> None:
        self.client.query.return_value.result.return_value = [
            SimpleNamespace(
                predicted_offset_f=3.25,
                top_feature_attributions=[
                    {"feature": "poverty_rate", "attribution": 1.5}
                ],
                geo_id="13121006802",
                total_pop=4200,
                poverty_rate=0.25,
                no_vehicle_rate=0.2,
                median_age=38.0,
                median_year_structure_built=1960,
            )
        ]

        result = tools.predict_heat_offset_and_explain(33.75, -84.39, baseline_forecast_f=100)

        self.assertEqual(result["tract_id"], "13121006802")
        self.assertEqual(result["predicted_heat_offset_f"], 3.25)
        self.assertEqual(result["predicted_surface_temp_f"], 103.25)
        self.assertEqual(result["top_feature_attributions"][0]["attribution_deg_f"], 1.5)
        sql = self.client.query.call_args.args[0]
        self.assertIn("test-project.test_climate.atlanta_offset", sql)
        self.assertNotIn("planning_offset", sql)
        self.client.get_model.assert_called_once()

    def test_tract_lookup_remains_parameterized(self) -> None:
        self.client.query.return_value.result.return_value = []
        tract_id = "13121006802"

        result = tools.predict_heat_offset_and_explain(tract_id=tract_id)

        self.assertIn("error", result)
        sql = self.client.query.call_args.args[0]
        self.assertIn("WHERE geo_id = @tract_id", sql)
        self.assertNotIn(tract_id, sql)
        params = self.client.query.call_args.kwargs["job_config"].query_parameters
        self.assertEqual(params[0].value, tract_id)

    def test_planning_model_bootstrap_never_discovers_or_replaces_atlanta_model(self) -> None:
        self.runtime = tools.HeatResilienceRuntime(
            config=replace(self.config, auto_bootstrap_bqml=True), client=self.client
        )
        self.client.get_model.side_effect = NotFound("Missing planning model")

        model = self.runtime.resolve_or_bootstrap_model()

        self.assertEqual(model, "test-project.test_climate.planning_offset")
        self.client.get_model.assert_called_once_with(model)
        self.client.query.assert_called_once()
        sql = self.client.query.call_args.args[0]
        self.assertIn(f"CREATE MODEL IF NOT EXISTS `{model}`", sql)
        self.assertIn("input_label_cols = ['heat_offset_f']", sql)
        self.assertNotIn("atlanta_offset", sql)
        self.assertNotIn("INFORMATION_SCHEMA", sql)

    def test_model_resolution_is_cached(self) -> None:
        first = self.runtime.resolve_or_bootstrap_model()
        second = self.runtime.resolve_or_bootstrap_model()

        self.assertEqual(first, second)
        self.client.get_model.assert_called_once_with(first)
        self.client.query.assert_not_called()

    def test_identical_model_names_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "must differ"):
            AgentConfig(
                project_id="test-project",
                bqml_model_name="same_model",
                planning_bqml_model_name="same_model",
            )
        self.client.get_model.assert_not_called()

    def test_missing_model_with_bootstrap_disabled_reports_error(self) -> None:
        config = AgentConfig(project_id="test-project", auto_bootstrap_bqml=False)
        runtime = tools.HeatResilienceRuntime(config=config, client=self.client)
        self.client.get_model.side_effect = NotFound("Missing planning model")

        with self.assertRaisesRegex(ToolFailure, "No BigQuery ML model found"):
            runtime.resolve_or_bootstrap_model()
        self.client.query.assert_not_called()

    def test_lazy_client_can_be_created_while_loading_metadata(self) -> None:
        runtime = tools.HeatResilienceRuntime(config=self.config)
        self.client.query.return_value.result.return_value = [
            {
                "city": "Atlanta",
                "total_observations": 100,
                "city_avg_temp_f": 95.0,
                "city_min_temp_f": 90.0,
                "city_max_temp_f": 105.0,
                "min_lat": 33.6,
                "max_lat": 33.9,
                "min_lon": -84.6,
                "max_lon": -84.2,
            }
        ]
        with patch.object(planning_tools.bigquery, "Client", return_value=self.client) as factory:
            metadata = runtime.get_city_metadata()

        self.assertEqual(metadata.city, "Atlanta")
        factory.assert_called_once_with(project="test-project", location=self.config.location)

    def test_configured_mcp_load_errors_are_not_silently_ignored(self) -> None:
        config = AgentConfig(
            project_id="test-project", mcp_toolbox_url="http://localhost:5000"
        )
        with patch("toolbox_core.ToolboxSyncClient") as factory:
            factory.return_value.load_toolset.side_effect = RuntimeError("Toolbox unavailable")
            with self.assertRaisesRegex(RuntimeError, "Toolbox unavailable"):
                build_agent(config)


if __name__ == "__main__":
    unittest.main()
