import unittest
from unittest.mock import Mock

from data_plane.pipelines.audit_ranking import (
    audit, average_ranks, candidate, ranking_sql, sensitivity, spearman, summarize,
)


SOURCE = "20261027_163945_a1f7fcb70be3"
TUNED = "20261027_164544_b1e872144cc1"
NAMESPACE = "sample-project.test_data"


def group(index, predicted=None, cell=None, n=30):
    observed = float(index)
    predicted = observed if predicted is None else float(predicted)
    error = predicted - observed
    return {
        "geo_id": f"{index:011d}", "spatial_cell": cell, "n": n, "cells": 1,
        "observed_sum": observed * n, "predicted_sum": predicted * n,
        "absolute_error_sum": abs(error) * n, "squared_error_sum": error ** 2 * n,
        "error_sum": error * n, "baseline_absolute_sum": abs(observed) * n,
        "baseline_squared_sum": observed ** 2 * n, "p90_absolute_error_f": abs(error),
    }


class RankingTests(unittest.TestCase):
    def test_perfect_ranking(self):
        result = summarize([group(i) for i in range(10)])
        self.assertEqual(result["status"], "DEVELOPMENT_EVIDENCE")
        metrics = result["ranking_metrics"]
        self.assertAlmostEqual(metrics["spearman"], 1)
        self.assertEqual(metrics["precision_at_5"], 1)
        self.assertEqual(metrics["ndcg_at_5"], 1)
        self.assertEqual(metrics["tract_mean_absolute_error_f"], 0)

    def test_reversed_ranking(self):
        metrics = summarize([group(i, 9 - i) for i in range(10)])["ranking_metrics"]
        self.assertAlmostEqual(metrics["spearman"], -1)
        self.assertEqual(metrics["top5_overlap"], 0)
        self.assertLess(metrics["ndcg_at_5"], 1)
        self.assertGreater(metrics["observation_mae_f"], 0)

    def test_tied_spearman_uses_average_ranks(self):
        self.assertEqual(average_ranks([3, 1, 1]), [3, 1.5, 1.5])
        self.assertAlmostEqual(spearman([1, 1, 3], [1, 2, 3]), 0.8660254037844387)
        self.assertIsNone(spearman([1, 1], [1, 2]))

    def test_constant_prediction_is_inconclusive(self):
        result = summarize([group(i, 0) for i in range(10)])
        self.assertEqual(result["status"], "INCONCLUSIVE")
        self.assertIsNone(result["ranking_metrics"]["spearman"])

    def test_constant_observations_have_no_meaningful_shortlist_score(self):
        groups = [group(i) for i in range(10)]
        for g in groups:
            g["observed_sum"] = 0
        result = summarize(groups)
        self.assertEqual(result["status"], "INCONCLUSIVE")
        for key in ("spearman", "top5_overlap", "precision_at_5", "ndcg_at_5"):
            self.assertIsNone(result["ranking_metrics"][key])

    def test_low_support_never_reduces_top_k_silently(self):
        result = summarize([group(i) for i in range(9)] + [group(9, n=29)])
        self.assertEqual(result["status"], "INCONCLUSIVE")
        self.assertIsNone(result["ranking_metrics"])
        self.assertEqual(result["excluded_tracts"], 1)
        self.assertEqual(summarize([])["eligible_tracts"], 0)

    def test_tract_mae_weights_tracts_equally(self):
        groups = [group(i) for i in range(10)]
        groups[0] = group(0, 10, n=3000)
        metrics = summarize(groups)["ranking_metrics"]
        self.assertEqual(metrics["tract_mean_absolute_error_f"], 1)
        self.assertGreater(metrics["observation_mae_f"], 9)

    def test_leave_one_cell_out_reaggregates_and_reports_support_loss(self):
        groups = [group(i, cell="a") for i in range(10)]
        groups += [group(i, cell="b", n=10) for i in range(10)]
        result = sensitivity(groups)
        self.assertEqual(result[0]["omitted_cell"], "a")
        self.assertEqual(result[0]["eligible_tracts"], 0)
        self.assertEqual(result[0]["status"], "INCONCLUSIVE")
        self.assertEqual(result[1]["ranking_metrics"]["precision_at_5"], 1)

    def test_sql_aligns_anchors_and_excludes_labels_from_prediction_input(self):
        sql = ranking_sql(NAMESPACE, SOURCE, [{
            "run": TUNED, "model": f"{NAMESPACE}.heat_offset_model_{TUNED}",
            "features": f"{NAMESPACE}.tuning_features_{TUNED}",
        }])
        self.assertIn("p.predicted_offset_f + a.anchor - e.training_mean_temp_f", sql)
        inputs = sql.split("ML.PREDICT(", 1)[1].split(")) AS p")[0]
        self.assertNotIn("offset_f", inputs)
        self.assertNotIn("temp_f", inputs)
        self.assertIn("WHERE is_eval", sql)
        self.assertIn("GROUPING SETS", sql)
        self.assertNotIn("CREATE ", sql)

    def test_invalid_source_id_rejected(self):
        with self.assertRaises(ValueError):
            ranking_sql(NAMESPACE, SOURCE + "`", [])

    def test_wrong_lineage_blocks_audit(self):
        bq = Mock()
        bq.query.return_value = [{
            "candidate_model": f"{NAMESPACE}.heat_offset_model_{TUNED}",
            "payload": {"feature_table": f"{NAMESPACE}.tuning_features_{TUNED}"},
        }]
        with self.assertRaisesRegex(ValueError, "not descended"):
            candidate(bq, NAMESPACE, TUNED, SOURCE)

    def test_missing_predictions_block_results(self):
        bq = Mock(project="sample-project", location="US", identifier="test")
        bq.query.side_effect = [
            [{"candidate_model": f"{NAMESPACE}.heat_offset_model_{SOURCE}",
              "payload": {"feature_table": f"{NAMESPACE}.training_data_{SOURCE}"}}],
            [{"evaluation_checks": {
                "n": 300, "unique_ids": 300, "invalid_rows": 0, "anchors": 1,
                "invalid_anchors": 0,
            }, "prediction_checks": []}],
        ]
        with self.assertRaisesRegex(ValueError, "Incomplete candidate"):
            audit(bq, "test_data", SOURCE, [SOURCE])

    def audit_client(self):
        bq = Mock(project="sample-project", location="US", identifier="test")
        groups = [{**group(i), "candidate_run": SOURCE} for i in range(10)]
        groups += [{**group(i, cell="a"), "candidate_run": SOURCE} for i in range(10)]
        bq.query.side_effect = [
            [{"candidate_model": f"{NAMESPACE}.heat_offset_model_{SOURCE}",
              "payload": {"feature_table": f"{NAMESPACE}.training_data_{SOURCE}"}}],
            [{"evaluation_checks": {
                "n": 300, "unique_ids": 300, "invalid_rows": 0, "anchors": 1,
                "invalid_anchors": 0,
            }, "prediction_checks": [{
                "candidate_run": SOURCE, "n": 300, "unique_ids": 300,
                "invalid_predictions": 0,
            }], "tract_groups": groups}],
        ]
        bq.model.return_value = {"etag": "same"}
        bq.job_statistics.return_value = {"status": {"state": "DONE"}}
        return bq

    def test_success_records_audit_not_approval(self):
        bq = self.audit_client()
        result = audit(bq, "test_data", SOURCE, [SOURCE])
        self.assertEqual(result["acceptance"], "PENDING_NOT_A_RELEASE_GATE")
        self.assertEqual(result["results"][SOURCE]["ranking_metrics"]["top5_overlap"], 5)
        bq.copy_model.assert_not_called()
        self.assertEqual(bq.query.call_count, 2)

    def test_concurrent_model_change_blocks_report(self):
        bq = self.audit_client()
        bq.model.side_effect = [{"etag": "before"}, {"etag": "after"}]
        with self.assertRaisesRegex(RuntimeError, "changed during audit"):
            audit(bq, "test_data", SOURCE, [SOURCE])


if __name__ == "__main__":
    unittest.main()
