import sys
import unittest
from unittest.mock import patch


from data_plane.pipelines.tune_candidate import (
    BigQuery, FOLDS, REGULARIZATION, TrainingRun, fit_sql, select_configuration, tune, validation_sql,
)


class TuningTests(unittest.TestCase):
    def test_training_and_validation_use_disjoint_inner_rows(self):
        train = fit_sql("project.dataset.model", "project.dataset.folds", 1, 1000)
        validation = validation_sql("project.dataset.model", "project.dataset.folds", 1)
        self.assertIn("WHERE inner_fold != 1", train)
        self.assertIn("WHERE inner_fold = 1", validation)
        self.assertIn("AVG(IF(inner_fold != 1, temp_f, NULL))", train)
        self.assertIn("AVG(IF(inner_fold != 1, temp_f, NULL))", validation)
        self.assertIn("DATA_SPLIT_METHOD='NO_SPLIT'", train)
        self.assertIn("L2_REG=1000", train)
        self.assertNotIn("OR REPLACE", train)

    def test_configuration_chosen_by_inner_mse_only(self):
        rows = [
            {"l2": l2, "fold": fold, "metrics": {"mean_squared_error": 3 if l2 == 1000 else 4}}
            for l2 in REGULARIZATION for fold in range(FOLDS)
        ]
        self.assertEqual(select_configuration(rows)["selected_l2"], 1000)
        rows.pop()
        with self.assertRaises(ValueError):
            select_configuration(rows)

    def test_nonfinite_mse_is_rejected(self):
        rows = [
            {"l2": l2, "fold": fold, "metrics": {"mean_squared_error": float("nan")}}
            for l2 in REGULARIZATION for fold in range(FOLDS)
        ]
        with self.assertRaises(ValueError):
            select_configuration(rows)

    def test_invalid_folds_and_regularization_rejected(self):
        with self.assertRaises(ValueError):
            fit_sql("model", "table", 4, 1000)
        with self.assertRaises(ValueError):
            fit_sql("model", "table", 0, -1)

    def test_plan_does_not_call_bigquery(self):
        from data_plane.pipelines import tune_candidate
        with (
            patch.object(sys, "argv", ["tune_candidate.py", "--project", "sample-project",
                                     "--parent-run", "20261027_163945_a1f7fcb70be3"]),
            patch("builtins.print"),
            patch.object(tune_candidate, "tune") as tune,
        ):
            tune_candidate.main()
            tune.assert_not_called()

    def test_selection_precedes_outer_evaluation_and_parent_sources_are_preserved(self):
        parent_id = "20261027_163945_a1f7fcb70be3"
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        parent = {
            "feature_table": f"sample-project.test_data.training_data_{parent_id}",
            "metrics": {"mean_absolute_error": 1.5, "mean_squared_error": 3.6},
        }
        order = []

        def execute(stage, sql, *args, **kwargs):
            order.append(stage)
            if stage == "inner_split":
                self.assertIn("WHERE NOT is_eval", sql)
            if stage == "inner_checks":
                return [{"inner_fold": fold, "cells": 3, "outer_rows": 0} for fold in range(3)]
            if stage.startswith("score_"):
                return [{"mean_squared_error": 2.0}]
            if stage == "evaluate":
                return [{"mean_absolute_error": 1.4, "mean_squared_error": 3.2, "r2_score": 0.1}]
            if stage == "baseline":
                return [{"mean_absolute_error": 1.6, "mean_squared_error": 3.3}]
            if stage == "explain":
                return [{"predicted_offset_f": 0.2, "top_feature_attributions": [
                    {"feature": feature, "attribution": 0.1}
                    for feature in ("latitude", "longitude", "median_age")
                ]}]
            return []

        def event(stage, state, payload):
            order.append(f"event_{stage}_{state}")

        with (
            patch("data_plane.pipelines.tune_candidate.code_manifest", return_value={}),
            patch.object(training.bq, "query", return_value=[{"payload": parent}]),
            patch.object(training.bq, "model", return_value={"etag": "same"}),
            patch.object(training, "execute", side_effect=execute),
            patch.object(training, "event", side_effect=event),
        ):
            result = tune(training, parent_id)
        self.assertLess(order.index("event_selection_SUCCEEDED"), order.index("evaluate"))
        self.assertEqual(len([stage for stage in order if stage.startswith("fit_")]), 9)
        self.assertEqual(result["heat_source"], f"sample-project.test_data.heat_snapshot_{parent_id}")
        self.assertFalse(result["promoted"])
        self.assertTrue(result["active_model_unchanged"])


if __name__ == "__main__":
    unittest.main()
