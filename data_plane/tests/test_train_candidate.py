import json
import sys
import unittest
from unittest.mock import patch
import subprocess


from data_plane.pipelines.train_candidate import (
    BigQuery, FEATURES, TrainingRun, check_metrics, quality_warnings, render, run_id,
    validate_namespace,
)


class TemplateTests(unittest.TestCase):
    def setUp(self):
        self.training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")

    def test_candidate_creation_cannot_replace_active_model(self):
        sql = self.training.template("train_model.sql")
        self.assertIn("CREATE MODEL `sample-project.test_data.heat_offset_model_test_run`", sql)
        self.assertNotIn("OR REPLACE", sql)
        self.assertNotIn("temp_f,", sql)
        self.assertNotIn("geo_id,", sql)
        self.assertNotIn("spatial_cell,", sql)
        self.assertIn("DATA_SPLIT_COL = 'is_eval'", sql)
        for feature in FEATURES:
            self.assertIn(feature, sql)

    def test_training_and_inference_share_cleaning(self):
        for name in ("prepare_features.sql", "explain_prediction.sql"):
            sql = self.training.template(name)
            self.assertIn("WHEN median_income >= 0 THEN median_income ELSE 65000.0", sql)
            self.assertIn("sample-project.test_data.tract_snapshot_test_run", sql)
            self.assertNotIn("{{", sql)

    def test_evaluation_uses_explicit_holdout(self):
        self.assertIn("WHERE is_eval", self.training.template("evaluate_model.sql"))

    def test_target_anchor_excludes_holdout_temperatures(self):
        sql = self.training.template("prepare_features.sql")
        self.assertIn("AVG(IF(NOT is_eval, temp_f, NULL))", sql)
        self.assertIn("PARTITION BY observation.observation_id", sql)
        self.assertIn("MOD(MOD(FARM_FINGERPRINT(spatial_cell), 5) + 5, 5)", sql)

    def test_missing_template_value_is_an_error(self):
        with self.assertRaisesRegex(ValueError, "Missing SQL"):
            render("SELECT {{missing}}", {})

    def test_names_are_validated(self):
        validate_namespace("sample-project", "sample_dataset", "us-central1")
        for project, dataset in (
            ("bad`project", "test"), ("sample-project", "test`; DROP TABLE data"),
        ):
            with self.assertRaises(ValueError):
                validate_namespace(project, dataset, "US")

    def test_run_ids_are_unique_and_bigquery_label_safe(self):
        first, second = run_id(), run_id()
        self.assertNotEqual(first, second)
        self.assertRegex(first, r"^[0-9]{8}_[0-9]{6}_[a-f0-9]{12}$")


class MetricTests(unittest.TestCase):
    def test_negative_r2_and_worse_mse_are_preserved_as_warnings(self):
        warnings = quality_warnings(
            {"r2_score": -0.1, "mean_squared_error": 3.6},
            {"mean_squared_error": 3.3},
        )
        self.assertEqual(len(warnings), 2)

    def test_candidate_beats_zero_offset_baseline(self):
        check_metrics({"mean_absolute_error": 1.0, "mean_squared_error": 2.0, "r2_score": 0.1}, 1.2)

    def test_bad_metrics_fail_explicitly(self):
        for mae, mse, r2 in (
            (2, 4, 0), (1, 2, 0.99), (1, 2, float("nan")), (-1, 2, 0), (1, -2, 0),
        ):
            with self.subTest(mae=mae, mse=mse, r2=r2), self.assertRaises(ValueError):
                check_metrics({"mean_absolute_error": mae, "mean_squared_error": mse, "r2_score": r2}, 1.2)


class AuditTests(unittest.TestCase):
    @patch("data_plane.pipelines.train_candidate.subprocess.run")
    def test_successful_ddl_has_text_output_even_with_json_format(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, stdout="Table created.\n", stderr="")
        bq = BigQuery("sample-project", "US", "test_run", 1000000000)
        self.assertEqual(bq.query("CREATE TABLE", "features", fetch_rows=False), [])

    @patch("data_plane.pipelines.train_candidate.subprocess.run")
    def test_malformed_select_output_is_not_silently_discarded(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, stdout="not JSON", stderr="")
        with self.assertRaises(json.JSONDecodeError):
            BigQuery("sample-project", "US", "test_run", 1000000000).query("SELECT 1", "check")

    @patch("data_plane.pipelines.train_candidate.subprocess.run")
    def test_model_metadata_uses_cli_colon_not_sql_dot_notation(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, stdout='{"etag": "active"}', stderr="")
        bq = BigQuery("sample-project", "US", "test_run", 1000000000)
        self.assertEqual(bq.model("sample-project.test_data.heat_offset_model"), {"etag": "active"})
        self.assertEqual(run.call_args.args[0][-1], "sample-project:test_data.heat_offset_model")

    @patch("data_plane.pipelines.train_candidate.subprocess.run")
    def test_query_sets_explicit_project_cost_cap_and_job_id(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, stdout='[{"ok": true}]', stderr="")
        bq = BigQuery("sample-project", "US", "test_run", 1000000000)
        self.assertEqual(bq.query("SELECT TRUE AS ok", "test", job_id="fixed"), [{"ok": True}])
        command = run.call_args.args[0]
        self.assertIn("--project_id=sample-project", command)
        self.assertIn("--job_id=fixed", command)
        self.assertIn("--maximum_bytes_billed=1000000000", command)
        self.assertIn("--label=training_run:test_run", command)

    @patch("data_plane.pipelines.train_candidate.subprocess.run")
    def test_query_error_includes_stage_and_job_id(self, run):
        run.return_value = subprocess.CompletedProcess([], 1, stdout="", stderr="Denied")
        with self.assertRaisesRegex(RuntimeError, "stage train, job fixed failed"):
            BigQuery("sample-project", "US", "test_run", 1000000000).query(
                "CREATE MODEL", "train", job_id="fixed",
            )

    def test_submitted_event_precedes_execution_and_keeps_sql(self):
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        with (
            patch.object(training, "event") as event,
            patch.object(training.bq, "query") as query,
            patch.object(training.bq, "job_statistics", return_value={"statistics": {"totalSlotMs": "123"}}),
        ):
            query.return_value = []
            training.execute("features", "CREATE TABLE test")
            self.assertEqual(event.call_args_list[0].args[1], "SUBMITTED")
            self.assertEqual(event.call_args_list[0].args[2]["sql"], "CREATE TABLE test")
            self.assertEqual(event.call_args_list[1].args[1], "SUCCEEDED")
            self.assertEqual(
                event.call_args_list[1].args[2]["job_metadata"]["statistics"]["totalSlotMs"],
                "123",
            )

    def test_failed_stage_is_recorded_and_propagated(self):
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        with (
            patch("data_plane.pipelines.train_candidate.code_manifest", return_value={}),
            patch.object(training.bq, "model", return_value={"etag": "active"}),
            patch.object(training.bq, "query", return_value=[]),
            patch.object(training, "event") as event,
            patch.object(training, "execute", side_effect=RuntimeError("test failure")),
        ):
            with self.assertRaisesRegex(RuntimeError, "test failure"):
                training.run()
            self.assertEqual(event.call_args_list[-1].args[:2], ("run", "FAILED"))
            self.assertIn("test failure", event.call_args_list[-1].args[2]["error"])

    def test_plan_mode_does_not_call_bigquery(self):
        from data_plane.pipelines import train_candidate
        with (
            patch.object(sys, "argv", ["train_candidate.py", "--project", "sample-project"]),
            patch("builtins.print") as output,
            patch.object(BigQuery, "query") as query,
            patch.object(BigQuery, "model") as model,
        ):
            train_candidate.main()
            query.assert_not_called()
            model.assert_not_called()
            self.assertEqual(json.loads(output.call_args.args[0])["mode"], "plan_only")


if __name__ == "__main__":
    unittest.main()
