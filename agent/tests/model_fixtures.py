"""Realistic BigQuery model metadata for offline serving tests."""

from types import SimpleNamespace

from google.cloud.bigquery import StandardSqlField

from agent.contracts import MODEL_FEATURES, MODEL_LABELS


def sql_field(name: str, kind: str = "FLOAT64") -> StandardSqlField:
    return StandardSqlField.from_api_repr({"name": name, "type": {"typeKind": kind}})


def model_metadata(resource: str, **kwargs: object) -> SimpleNamespace:
    family = "planning" if resource.rsplit(".", 1)[-1] in {
        "heat_planning_model", "planning_offset",
    } else "atlanta"
    return SimpleNamespace(
        feature_columns=[sql_field(name) for name in MODEL_FEATURES[family]],
        label_columns=[sql_field(f"predicted_{MODEL_LABELS[family]}")],
        model_type="LINEAR_REGRESSION", etag="test-model-etag",
    )
