import sys
import unittest
from unittest.mock import patch


from data_plane.pipelines.promote_candidate import (
    BigQuery, TrainingRun, get_candidate_event, promote, rollback,
)


class PromoteCandidateTests(unittest.TestCase):
    def test_plan_does_not_modify_models(self):
        from data_plane.pipelines import promote_candidate
        with (
            patch.object(sys, "argv", [
                "promote_candidate.py", "--project", "sample-project",
                "--candidate-run", "20261027_164544_b1e872144cc1",
            ]),
            patch("builtins.print"),
            patch.object(promote_candidate, "promote") as mock_promote,
        ):
            promote_candidate.main()
            mock_promote.assert_not_called()

    def test_invalid_candidate_id_rejected(self):
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        with self.assertRaises(ValueError):
            promote(training, "invalid_id")

    def test_promotion_requires_validated_candidate(self):
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        with patch.object(training.bq, "query", return_value=[]):
            with self.assertRaisesRegex(ValueError, "must be a completed and validated"):
                promote(training, "20261027_164544_b1e872144cc1")

    def test_promotion_backs_up_and_replaces_active_model(self):
        candidate_run = "20261027_164544_b1e872144cc1"
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        candidate_payload = {
            "candidate_model": f"sample-project.test_data.heat_offset_model_{candidate_run}",
            "metrics": {"mean_absolute_error": 1.46, "mean_squared_error": 3.32},
        }

        active_name = "sample-project.test_data.heat_offset_model"
        copied_models = []

        def mock_copy(src, dst, force=False):
            copied_models.append((src, dst, force))

        smoke_output = [{
            "predicted_offset_f": 1.5,
            "top_feature_attributions": [
                {"feature": "median_age", "attribution": 0.5},
                {"feature": "latitude", "attribution": 0.3},
                {"feature": "longitude", "attribution": -0.2},
            ],
            "geo_id": "13121006802",
            "total_pop": 3500,
            "income_imputed": False,
        }]

        with (
            patch("data_plane.pipelines.promote_candidate.code_manifest", return_value={}),
            patch.object(training.bq, "query", return_value=[{"state": "VALIDATED_CANDIDATE", "payload": candidate_payload}]),
            patch.object(training.bq, "model", side_effect=[
                {"etag": "cand_etag"},  # candidate_meta
                {"etag": "old_etag"},   # active_before
                {"etag": "backup_etag"},# backup_meta
                {"etag": "new_etag"},   # active_after
            ]),
            patch.object(training.bq, "copy_model", side_effect=mock_copy),
            patch.object(training, "execute", return_value=smoke_output),
            patch.object(training, "event") as mock_event,
        ):
            result = promote(training, candidate_run)

        self.assertTrue(result["promoted"])
        self.assertEqual(result["previous_etag"], "old_etag")
        self.assertEqual(result["new_etag"], "new_etag")
        # Check that backup happened first, then candidate was copied with force=True
        self.assertEqual(copied_models[0][0], active_name)
        self.assertTrue(copied_models[0][1].startswith("sample-project.test_data.heat_offset_model_backup_"))
        self.assertFalse(copied_models[0][2]) # force is False for backup
        self.assertEqual(copied_models[1][0], candidate_payload["candidate_model"])
        self.assertEqual(copied_models[1][1], active_name)
        self.assertTrue(copied_models[1][2]) # force is True for overwrite
        self.assertEqual(mock_event.call_args_list[-1].args[:2], ("promotion", "PROMOTED"))

    def test_rollback_restores_from_backup(self):
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        backup_model = "sample-project.test_data.heat_offset_model_backup_20261027_164544"
        active_name = "sample-project.test_data.heat_offset_model"

        copied_models = []
        def mock_copy(src, dst, force=False):
            copied_models.append((src, dst, force))

        smoke_output = [{
            "predicted_offset_f": 1.2,
            "top_feature_attributions": [
                {"feature": "median_age", "attribution": 0.4},
                {"feature": "latitude", "attribution": 0.2},
                {"feature": "longitude", "attribution": -0.1},
            ],
            "geo_id": "13121006802",
            "total_pop": 3500,
            "income_imputed": False,
        }]

        with (
            patch("data_plane.pipelines.promote_candidate.code_manifest", return_value={}),
            patch.object(training.bq, "model", side_effect=[
                {"etag": "backup_etag"}, # backup_meta
                {"etag": "current_etag"},# active_before
                {"etag": "restored_etag"},# active_after
            ]),
            patch.object(training.bq, "copy_model", side_effect=mock_copy),
            patch.object(training, "execute", return_value=smoke_output),
            patch.object(training, "event") as mock_event,
        ):
            result = rollback(training, backup_model)

        self.assertTrue(result["rolled_back"])
        self.assertEqual(copied_models[0][0], active_name)
        self.assertTrue(copied_models[0][1].startswith("sample-project.test_data.heat_offset_model_pre_rollback_"))
        self.assertEqual(copied_models[1][0], backup_model)
        self.assertEqual(copied_models[1][1], active_name)
        self.assertTrue(copied_models[1][2])
        self.assertEqual(mock_event.call_args_list[-1].args[:2], ("rollback", "ROLLED_BACK"))


if __name__ == "__main__":
    unittest.main()
