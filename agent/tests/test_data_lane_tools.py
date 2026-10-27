"""Merged data-lane capabilities must retain the shared runtime safeguards."""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from agent import tools
from agent.config import AgentConfig
from agent.tests.model_fixtures import model_metadata


class TestDataLaneTools(unittest.TestCase):
    def setUp(self) -> None:
        self.addCleanup(tools.set_runtime, tools.get_runtime())
        self.client = MagicMock()
        self.client.get_model.side_effect = model_metadata
        tools.set_runtime(tools.HeatResilienceRuntime(
            AgentConfig(project_id="test-project"), self.client
        ))

    def test_ranking_returns_explanations_and_contextual_canopy(self) -> None:
        self.client.query.return_value.result.return_value = [SimpleNamespace(
            geo_id="13121006802", tract_lat=33.74, tract_lon=-84.39,
            offset_f=3.5, total_pop=3200, poverty_pct=30, no_vehicle_pct=25,
            median_age=36, composite_vulnerability_score=3.5, tree_canopy_pct=14,
            top_feature_attributions=[{"feature": "median_income", "attribution": 1.2}],
        )]
        result = tools.rank_cooling_center_sites(1)
        self.assertEqual(result["ranked_sites"][0]["tree_canopy_pct"], 14)
        self.assertEqual(result["ranked_sites"][0]["top_feature_attributions"][0]["attribution_deg_f"], 1.2)
        sql = self.client.query.call_args.args[0]
        self.assertIn("ML.EXPLAIN_PREDICT", sql)
        self.assertIn("STRUCT(3 AS top_k_features)", sql)

    def test_canopy_interventions_use_bounded_parameterized_queries(self) -> None:
        self.client.query.return_value.result.return_value = [SimpleNamespace(
            tract_id="13121006802", tract_name="Census Tract 68.02",
            population=3500, pop_density=4200, mean_temp_f=93.4,
            tree_canopy_pct=12.5, svi_percentile=0.88, integrated_risk_score=4.15,
            poverty_pct=32, no_vehicle_pct=28,
        )]
        result = tools.recommend_canopy_interventions(1)
        self.assertEqual(result["recommended_priority_tracts"][0]["city_target_gap_pct"], 37.5)
        self.assertEqual(len(result["recommended_priority_tracts"][0]["priority_interventions"]), 4)
        config = self.client.query.call_args.kwargs["job_config"]
        self.assertEqual(config.maximum_bytes_billed, 1_000_000_000)
        self.assertEqual([p.value for p in config.query_parameters], [1, 1000.0])

    def test_canopy_rejects_invalid_inputs_before_query(self) -> None:
        with self.assertLogs("agent.tools", level="WARNING"):
            self.assertIn("error", tools.recommend_canopy_interventions(21))
            self.assertIn("error", tools.recommend_canopy_interventions(min_pop_density=float("nan")))
        self.client.query.assert_not_called()

    def test_explicit_candidate_model_is_validated(self) -> None:
        self.client.query.return_value.result.return_value = []
        with self.assertLogs("agent.tools", level="WARNING"):
            tools.rank_cooling_center_sites(model_name="candidate_123")
            tools.predict_heat_offset_and_explain(33.75, -84.39, model_name="bad`model")
        self.assertIn("test-project.a4i_climate.candidate_123", self.client.query.call_args.args[0])
        self.assertEqual(self.client.query.call_count, 1)

    def test_proposal_preserves_public_response_and_avoids_false_verification(self) -> None:
        site = {
            "tract_id": "13121006802", "latitude": 33.74, "longitude": -84.39,
            "predicted_heat_offset_f": -1, "population": 3200,
            "poverty_rate_pct": 30, "no_vehicle_rate_pct": 25,
            "top_feature_attributions": [{"feature": "median_income", "attribution_deg_f": -0.5}],
        }
        with patch.object(tools, "rank_cooling_center_sites", return_value={"ranked_sites": [site]}), \
             patch.object(tools, "audit_equity", return_value={"audit_finding": "MODERATE"}), \
             patch.object(tools, "recommend_canopy_interventions", return_value={"recommended_priority_tracts": []}):
            result = tools.generate_council_proposal(1, 100, "Proposed Fund")
        self.assertEqual(result["target_tract_ids"], ["13121006802"])
        self.assertEqual(result["funding_source"], "Proposed Fund")
        self.assertIn("title", result)
        self.assertIn("99.00 F", result["proposal_markdown"])
        self.assertIn("MODERATE", result["proposal_markdown"])
        self.assertIn("independent verification", result["proposal_markdown"])
        self.assertNotIn("VERIFIED", result["proposal_markdown"])

    def test_proposal_propagates_equity_failure(self) -> None:
        with patch.object(tools, "rank_cooling_center_sites", return_value={
            "ranked_sites": [{"tract_id": "13121006802"}],
        }), patch.object(tools, "audit_equity", return_value={"error": "incomplete audit"}), \
             patch.object(tools, "recommend_canopy_interventions") as canopy:
            result = tools.generate_council_proposal()
        self.assertEqual(result["error"], "incomplete audit")
        canopy.assert_not_called()
