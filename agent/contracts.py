"""Model schemas and the shared public tool-result boundary."""

from __future__ import annotations

import inspect
import logging
import math
from functools import wraps
from decimal import Decimal
from numbers import Real
from typing import Any, Callable, Literal, ParamSpec, TypedDict

from google.api_core import exceptions as gexc
from google.auth.exceptions import DefaultCredentialsError, RefreshError
from .telemetry import span

logger = logging.getLogger(__name__)
P = ParamSpec("P")
Family = Literal["atlanta", "planning"]

ATLANTA_FEATURES = frozenset({
    "latitude", "longitude", "median_income", "poverty_rate", "no_vehicle_rate",
    "median_age", "housing_units", "median_year_structure_built",
})
PLANNING_FEATURES = ATLANTA_FEATURES | {
    "dist_from_center_km", "total_pop", "structure_age_years",
    "housing_density_proxy", "no_cars", "households",
}
MODEL_FEATURES = {"atlanta": ATLANTA_FEATURES, "planning": PLANNING_FEATURES}
MODEL_LABELS = {"atlanta": "offset_f", "planning": "heat_offset_f"}
ACCEPTED_LABELS = {
    family: {label, f"predicted_{label}"} for family, label in MODEL_LABELS.items()
}
NUMERIC_TYPES = frozenset({"FLOAT", "FLOAT64", "INTEGER", "INT64", "NUMERIC", "BIGNUMERIC"})


class ToolError(TypedDict):
    status: Literal["ERROR"]
    error_code: str
    category: str
    error: str
    message: str
    retryable: bool


class ToolFailure(Exception):
    def __init__(self, code: str, message: str, category: str = "NO_DATA"):
        super().__init__(message)
        self.code = code
        self.category = category


def failure(code: str, message: str, category: str, retryable: bool = False) -> ToolError:
    return {
        "status": "ERROR", "error_code": code, "category": category,
        "error": message, "message": message, "retryable": retryable,
    }


def exception_result(exc: Exception) -> ToolError:
    if isinstance(exc, ToolFailure):
        return failure(exc.code, str(exc), exc.category)
    if isinstance(exc, (gexc.Forbidden, gexc.Unauthorized, DefaultCredentialsError, RefreshError)):
        return failure("PERMISSION_DENIED", "Cloud access denied. Verify credentials and IAM permissions.", "PERMISSION")
    if isinstance(exc, gexc.NotFound):
        return failure("RESOURCE_NOT_FOUND", "A required BigQuery resource was not found.", "NO_DATA")
    if isinstance(exc, (TimeoutError, gexc.DeadlineExceeded)):
        return failure("QUERY_TIMEOUT", "The operation exceeded its deadline.", "TIMEOUT", True)
    if isinstance(exc, (gexc.TooManyRequests, gexc.ServiceUnavailable)):
        return failure("SERVICE_UNAVAILABLE", "Cloud service temporarily unavailable or rate limited.", "UNAVAILABLE", True)
    if isinstance(exc, gexc.BadRequest):
        return failure("QUERY_REJECTED", "BigQuery rejected the query. Check the serving contract and query limits.", "QUERY")
    return failure("INTERNAL_ERROR", "An internal tool error occurred. Consult server logs.", "INTERNAL")


def required_number(row: Any, key: str) -> float:
    value = row.get(key) if hasattr(row, "get") else getattr(row, key, None)
    if value is None:
        raise ToolFailure("MISSING_EVIDENCE", f"Required evidence '{key}' is unavailable.")
    if isinstance(value, bool) or not isinstance(value, (Real, Decimal)):
        raise ToolFailure("INVALID_EVIDENCE", f"Evidence '{key}' is not numeric.", "CONTRACT")
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ToolFailure("INVALID_EVIDENCE", f"Evidence '{key}' is not numeric.", "CONTRACT") from exc
    if not math.isfinite(number):
        raise ToolFailure("INVALID_EVIDENCE", f"Evidence '{key}' is not finite.", "CONTRACT")
    return number


def explained_features(raw: Any, family: Family) -> list[dict[str, Any]]:
    if not raw:
        raise ToolFailure("NO_EXPLANATION", "The model returned no feature attributions.")
    result = []
    for attribution in raw:
        item = dict(attribution)
        if item.get("feature") not in MODEL_FEATURES[family]:
            raise ToolFailure("MODEL_CONTRACT_MISMATCH", "An explanation contains an undeclared feature.", "CONTRACT")
        result.append({
            "feature": item["feature"],
            "attribution": required_number(item, "attribution"),
        })
    return result


def validate_model_metadata(model: Any, family: Family, resource: str) -> dict[str, Any]:
    def field_types(columns: Any) -> dict[str, str]:
        return {
            column.name: column.type.type_kind.name
            if column.type is not None and column.type.type_kind is not None else "UNKNOWN"
            for column in columns
        }

    features = field_types(model.feature_columns)
    labels = field_types(model.label_columns)
    expected = MODEL_FEATURES[family]
    if (
        set(features) != expected
        or len(features) != len(model.feature_columns)
        or len(labels) != 1
        or not set(labels) <= ACCEPTED_LABELS[family]
        or any(kind not in NUMERIC_TYPES for kind in (*features.values(), *labels.values()))
        or model.model_type not in {"LINEAR_REG", "LINEAR_REGRESSION"}
    ):
        raise ToolFailure(
            "MODEL_CONTRACT_MISMATCH",
            f"Model {resource} does not match the {family} numeric-feature/label contract.",
            "CONTRACT",
        )
    return {
        "model": resource, "model_family": family, "model_etag": model.etag,
        "features": features, "label": labels, "model_type": model.model_type,
    }


def tool_boundary(function: Callable[P, dict[str, Any]]) -> Callable[P, dict[str, Any]]:
    """Keep payload fields compatible while normalizing success and explicit failure."""
    signature = inspect.signature(function)

    @wraps(function)
    def execute(*args: P.args, **kwargs: P.kwargs) -> dict[str, Any]:
        try:
            try:
                signature.bind(*args, **kwargs)
            except TypeError as exc:
                logger.warning("Tool %s received invalid arguments", function.__name__)
                return dict(failure("INVALID_ARGUMENTS", str(exc), "INVALID_INPUT"))
            result = function(*args, **kwargs)
            if "error" in result or result.get("status", "OK") != "OK":
                code = result.get("error_code", "TOOL_FAILED")
                category = result.get("category")
                if category is None:
                    if result.get("status") == "INVALID_INPUT" or code.startswith("INVALID_") or code == "EMPTY_TRACT_LIST":
                        category = "INVALID_INPUT"
                    elif "BOUNDS" in code:
                        category = "OUT_OF_BOUNDS"
                    else:
                        category = "NO_DATA"
                message = result.get("error") or result.get("message") or result.get("refusal_instruction") or "Required evidence is unavailable."
                logger.warning("Tool %s failed: %s (%s)", function.__name__, code, category)
                return {**result, **failure(code, message, category, result.get("retryable", False))}
            return {**result, "status": "OK"}
        except ToolFailure as exc:
            logger.warning("Tool %s has no usable evidence: %s", function.__name__, exc.code)
            return dict(exception_result(exc))
        except Exception as exc:
            logger.error("Tool %s raised %s", function.__name__, type(exc).__name__)
            return dict(exception_result(exc))

    @wraps(function)
    def wrapped(*args: P.args, **kwargs: P.kwargs) -> dict[str, Any]:
        with span("tool", tool_name=function.__name__) as observation:
            result = execute(*args, **kwargs)
            observation.result(result)
            return result
    return wrapped
