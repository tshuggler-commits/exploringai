"""Privacy-safe structured execution events; never log inputs or provider messages."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from collections.abc import Iterator
from typing import Any


logger = logging.getLogger("agent.telemetry")
logger.setLevel(logging.INFO)
logger.propagate = False
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)

_CONTEXT: ContextVar[dict[str, Any] | None] = ContextVar("heat_telemetry", default=None)


def conversation_id(app_name: str, user_id: str, session_id: str) -> str:
    identity = json.dumps([app_name, user_id, session_id], separators=(",", ":"))
    return hashlib.sha256(identity.encode()).hexdigest()


@contextmanager
def correlation(**fields: Any) -> Iterator[None]:
    token = _CONTEXT.set({**(_CONTEXT.get() or {}), **fields})
    try:
        yield
    finally:
        _CONTEXT.reset(token)


def emit(event: str, **fields: Any) -> None:
    record = {
        **(_CONTEXT.get() or {}), **fields, "event": event,
        "severity": "ERROR" if fields.get("status") == "ERROR" else "INFO",
    }
    logger.log(
        logging.ERROR if record["severity"] == "ERROR" else logging.INFO,
        json.dumps(record, separators=(",", ":"), allow_nan=False),
    )


def job_labels() -> dict[str, str]:
    context = _CONTEXT.get() or {}
    labels = {
        f"agent_{name}": context[field]
        for name, field in (("runtime", "runtime_id"), ("span", "span_id"))
        if context.get(field)
    }
    if context.get("invocation_id"):
        labels["agent_invocation"] = hashlib.sha256(
            context["invocation_id"].encode()
        ).hexdigest()[:32]
    return labels


class Span:
    def __init__(self) -> None:
        self.fields: dict[str, Any] = {"status": "OK"}

    def result(self, result: dict[str, Any]) -> None:
        self.fields.update({
            key: result[key] for key in ("status", "category", "error_code") if key in result
        })


@contextmanager
def span(kind: str, **fields: Any) -> Iterator[Span]:
    parent = _CONTEXT.get() or {}
    with correlation(parent_span_id=parent.get("span_id"), span_id=uuid.uuid4().hex, **fields):
        state = Span()
        started = time.monotonic()
        emit(f"{kind}.started")
        try:
            yield state
        except BaseException as exc:
            state.fields.update(
                status="CANCELLED" if isinstance(exc, (asyncio.CancelledError, GeneratorExit)) else "ERROR",
                exception_type=type(exc).__name__,
            )
            raise
        finally:
            emit(
                f"{kind}.finished",
                duration_ms=round((time.monotonic() - started) * 1000, 3),
                **state.fields,
            )
