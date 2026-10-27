import unittest
from unittest.mock import Mock

from data_plane.pipelines.audit_physical_features import audit, audit_sql


RUN = "20261027_163945_a1f7fcb70be3"


class PhysicalFeatureAuditTests(unittest.TestCase):
    def test_sql_uses_exact_geoid_and_duplicate_safe_coverage(self):
        sql = audit_sql("sample-project.test_data", RUN)
        self.assertIn(f"sample-project.test_data.training_data_{RUN}", sql)
        self.assertIn("GROUP BY GEOID", sql)
        self.assertIn("c.source_rows = 1 AND c.valid_rows = 1", sql)
        self.assertIn("ON f.geo_id = c.GEOID", sql)
        self.assertIn("IS_INF(tree_canopy_pct)", sql)
        self.assertIn("SAFE_DIVIDE(usable_rows, total_rows)", sql)
        self.assertNotIn("{{", sql)
        self.assertNotIn("CREATE ", sql)
        self.assertNotIn("ML.", sql)

    def test_rejects_resource_injection(self):
        for namespace, identifier in (
            ("sample-project.test_data", RUN + "`"),
            ("sample-project.test_data`", RUN),
            ("sample-project.other.dataset", RUN),
        ):
            with self.subTest(namespace=namespace, identifier=identifier):
                with self.assertRaises(ValueError):
                    audit_sql(namespace, identifier)

    def test_report_never_claims_feature_approval(self):
        bq = Mock(project="sample-project", identifier="audit_test")
        bq.query.return_value = [{"quality": {"source_rows": "109"}}]
        bq.job_statistics.return_value = {"status": {"state": "DONE"}}
        result = audit(bq, "test_data", RUN)
        self.assertEqual(result["mode"], "read_only_audit")
        self.assertEqual(result["feature_admission"],
                         "BLOCKED_PENDING_PROVENANCE_AND_COVERAGE_REVIEW")
        self.assertEqual(len(result["sql_sha256"]), 64)
        self.assertEqual(bq.query.call_count, 1)
        self.assertEqual(bq.query.call_args.kwargs["job_id"],
                         "a4i_audit_test_physical_features")
        bq.copy_model.assert_not_called()

    def test_missing_result_is_an_explicit_failure(self):
        bq = Mock(project="sample-project", identifier="audit_test")
        bq.query.return_value = []
        with self.assertRaisesRegex(ValueError, "Expected one"):
            audit(bq, "test_data", RUN)
        bq.job_statistics.assert_not_called()


if __name__ == "__main__":
    unittest.main()
