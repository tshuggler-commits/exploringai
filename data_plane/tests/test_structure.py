import ast
import json
import os
import subprocess
import sys
import tempfile
import unittest

from data_plane.pipelines.train_candidate import DATA_PLANE, FILES, ROOT, code_manifest


class StructureTests(unittest.TestCase):
    def test_recorded_sources_exist_inside_data_plane(self):
        manifest = code_manifest()
        self.assertEqual(set(manifest["source_files"]), set(FILES))
        for name in FILES:
            path = ROOT / name
            self.assertTrue(path.is_file())
            self.assertTrue(path.is_relative_to(DATA_PLANE))

    def test_workflows_do_not_import_agent_or_modify_python_search_path(self):
        for path in (DATA_PLANE / "pipelines").glob("*.py"):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    self.assertFalse(any(alias.name.split(".")[0] == "agent" for alias in node.names))
                elif isinstance(node, ast.ImportFrom):
                    self.assertNotEqual((node.module or "").split(".")[0], "agent")
            self.assertNotIn("sys.path.", path.read_text())

    def test_module_commands_plan_without_cloud_credentials(self):
        parent = "20261027_163945_a1f7fcb70be3"
        for workflow, arguments in (
            ("train_candidate", []),
            ("tune_candidate", ["--parent-run", parent]),
            ("audit_candidate", ["--parent-run", parent]),
            ("promote_candidate", ["--candidate-run", parent]),
            ("audit_physical_features", ["--feature-run", parent]),
            ("audit_ranking", ["--source-run", parent, "--candidate-run", parent]),
            ("audit_tree_planting", []),
        ):
            with self.subTest(workflow=workflow):
                result = subprocess.run(
                    [sys.executable, "-m", f"data_plane.pipelines.{workflow}",
                     "--project", "sample-project", *arguments],
                    cwd=ROOT, capture_output=True, text=True, check=True,
                )
                self.assertEqual(json.loads(result.stdout)["mode"], "plan_only")

    def test_moved_notebooks_remain_valid_documents(self):
        notebooks = list((DATA_PLANE / "notebooks").glob("*.ipynb"))
        self.assertEqual(len(notebooks), 2)
        for notebook in notebooks:
            document = json.loads(notebook.read_text())
            self.assertEqual(document["nbformat"], 4)
            self.assertIsInstance(document["cells"], list)

    def test_templates_are_resolved_without_caller_working_directory(self):
        from data_plane.pipelines.train_candidate import BigQuery, TrainingRun
        training = TrainingRun(BigQuery("sample-project", "US", "test_run", 1000000000), "test_data")
        previous = os.getcwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                for name in ("prepare_features.sql", "train_model.sql",
                             "evaluate_model.sql", "explain_prediction.sql"):
                    self.assertNotIn("{{", training.template(name))
                self.assertEqual(set(code_manifest()["source_files"]), set(FILES))
            finally:
                os.chdir(previous)


if __name__ == "__main__":
    unittest.main()
