import sys
import unittest
from unittest.mock import patch


from data_plane.pipelines.audit_candidate import (
    BigQuery, TrainingRun, audit, buffered_features_sql, diagnostics_sql, residuals_sql,
)


class AuditCandidateTests(unittest.TestCase):
    def test_buffer_excludes_fitting_rows_near_holdout_and_preserves_holdout(self):
        sql = buffered_features_sql("project.dataset.source", "project.dataset.buffered")
        self.assertIn("WHERE NOT fitting.is_eval AND held_out.is_eval", sql)
        self.assertIn("WHERE is_eval OR observation_id NOT IN", sql)
        self.assertIn("ST_DWITHIN", sql)
        self.assertIn("500", sql)
        self.assertIn("AVG(IF(NOT is_eval, temp_f, NULL))", sql)
        self.assertIn("EXCEPT(offset_f, training_mean_temp_f)", sql)
        self.assertNotIn("OR REPLACE", sql)

    def test_residual_prediction_excludes_target_from_model_input(self):
        sql = residuals_sql("model", "features", "residuals")
        prediction_input = sql.split("ML.PREDICT", 1)[1].split(")) AS prediction", 1)[0]
        self.assertIn("WHERE is_eval", prediction_input)
        self.assertNotIn("temp_f", prediction_input)
        self.assertNotIn("offset_f", prediction_input)
        self.assertIn("predicted_offset_f - data.offset_f AS error_f", sql)

    def test_diagnostics_report_counts_bias_and_baseline_without_individual_output(self):
        sql = diagnostics_sql("residuals")
        for key in ("row_count", "mae_f", "mse", "bias_f", "zero_offset_mae_f",
                    "income_imputation", "poverty_rate", "no_vehicle_rate", "spatial_cell"):
            self.assertIn(key, sql)
        self.assertIn("HAVING COUNT(*) >= 30", sql)

    def test_plan_never_executes(self):
        from data_plane.pipelines import audit_candidate
        with (
            patch.object(sys, "argv", ["audit_candidate.py", "--project", "sample-project",
                                     "--parent-run", "20261027_164544_b1e872144cc1"]),
            patch("builtins.print"),
            patch.object(audit_candidate, "audit") as audit,
        ):
            audit_candidate.main()
            audit.assert_not_called()

    def test_spatial_buffer_violation_is_recorded_and_blocks_training(self):
        parent_id = "20261027_164544_b1e872144cc1"
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        parent = {
            "feature_table": f"sample-project.test_data.tuning_features_{parent_id}",
            "candidate_model": f"sample-project.test_data.heat_offset_model_{parent_id}",
            "parent_run": "20261027_163945_a1f7fcb70be3", "selected_l2": 1000,
        }

        def execute(stage, sql, *args, **kwargs):
            if stage == "residual_checks_parent":
                return [{"row_count": 3218, "unique_observations": 3218,
                         "expected_rows": 3218, "invalid_errors": 0}]
            if stage == "buffer_checks":
                return [{"train_rows": 18018, "eval_rows": 3218, "original_eval_rows": 3218,
                         "buffer_violations": 1, "invalid_labels": 0}]
            return []

        with (
            patch("data_plane.pipelines.audit_candidate.code_manifest", return_value={}),
            patch.object(training.bq, "query", return_value=[{"payload": parent}]),
            patch.object(training.bq, "model", return_value={"etag": "same"}),
            patch.object(training, "execute", side_effect=execute) as commands,
            patch.object(training, "event") as events,
        ):
            with self.assertRaisesRegex(ValueError, "Buffered split checks failed"):
                audit(training, parent_id)
        self.assertNotIn("train", [call.args[0] for call in commands.call_args_list])
        self.assertEqual(events.call_args_list[-1].args[:2], ("run", "FAILED"))


if __name__ == "__main__":
    unittest.main()
