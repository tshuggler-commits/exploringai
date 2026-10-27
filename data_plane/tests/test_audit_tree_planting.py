import unittest
from unittest.mock import Mock

from data_plane.pipelines.audit_tree_planting import audit, audit_sql, scenario_contract


class PlantingAuditTests(unittest.TestCase):
    def test_sql_is_read_only_and_checks_cost_area_and_coverage(self):
        sql = audit_sql("sample-project", "test_data", "US")
        for field in ("marginal_planting_cost", "plantable_row_sqm", "lst_temp"):
            self.assertIn(field, sql)
        self.assertIn("IS_INF(value)", sql)
        self.assertIn("k.n = 1", sql)
        self.assertIn("COUNT(DISTINCT GEOID)", sql)
        self.assertNotIn("{{", sql)
        self.assertNotIn("CREATE ", sql)
        self.assertNotIn("ML.", sql)

    def test_invalid_namespace_is_rejected(self):
        with self.assertRaises(ValueError):
            audit_sql("sample-project", "test_data`", "US")

    def test_contract_cannot_claim_a_benefit(self):
        contract = scenario_contract()
        self.assertEqual(contract["status"], "BLOCKED_MISSING_VERIFIED_INPUTS")
        self.assertIsNone(contract["relief_per_dollar"])
        self.assertEqual(contract["recommended_sites"], [])
        self.assertTrue(all(v == "UNVERIFIED" for v in contract["requirements"].values()))
        self.assertIn("10 years", contract["horizon"])

    def test_complete_table_still_cannot_establish_cost_effectiveness(self):
        bq = Mock(project="sample-project", location="US", identifier="audit_test")
        bq.query.return_value = [{"key_quality": {"n": 109, "unique_geoids": 109}}]
        bq.job_statistics.return_value = {"status": {"state": "DONE"}}
        report = audit(bq, "test_data")
        self.assertIsNone(report["scenario"]["relief_per_dollar"])
        self.assertEqual(len(report["sql_sha256"]), 64)
        bq.copy_model.assert_not_called()
        self.assertEqual(bq.query.call_count, 1)

    def test_empty_query_response_is_explicit_failure(self):
        bq = Mock(project="sample-project", location="US", identifier="audit_test")
        bq.query.return_value = []
        with self.assertRaisesRegex(ValueError, "Expected one"):
            audit(bq, "test_data")


if __name__ == "__main__":
    unittest.main()
