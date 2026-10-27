"""Runtime isolation and real ADK-to-BigQuery telemetry without network calls."""

import asyncio
import json
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from unittest.mock import MagicMock, patch

from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool, ToolContext
from google.api_core.exceptions import Forbidden
from google.genai import types

from agent.agent import _configured_tool, build_agent
from agent.config import AgentConfig
from agent.contracts import tool_boundary
from agent.planning_tools import HeatResilienceRuntime, get_runtime, set_runtime, using_runtime
from agent.telemetry import conversation_id, correlation, span


def query_job(job_id="job-test", rows=()):
    job = MagicMock()
    job.job_id = job_id
    job.total_bytes_billed = 1024
    job.total_bytes_processed = 512
    job.slot_millis = 23
    job.cache_hit = False
    job.result.return_value = rows
    return job


def records(captured):
    return [json.loads(record.getMessage()) for record in captured.records]


class ToolCallingModel(BaseLlm):
    async def generate_content_async(self, llm_request, stream=False):
        await asyncio.sleep(0)
        responded = any(
            part.function_response
            for content in llm_request.contents for part in content.parts or []
        )
        part = (
            types.Part(text="Required evidence is unavailable.")
            if responded else types.Part(function_call=types.FunctionCall(
                name="query_heat_history", args={"threshold_f": 95.0}, id="call-test",
            ))
        )
        yield LlmResponse(
            content=types.Content(role="model", parts=[part]),
            usage_metadata=types.GenerateContentResponseUsageMetadata(
                prompt_token_count=5, candidates_token_count=2, total_token_count=7,
            ),
        )


class FailingModel(BaseLlm):
    async def generate_content_async(self, llm_request, stream=False):
        raise RuntimeError("SECRET provider error with prompt and credentials")
        yield  # pragma: no cover


class BlockingModel(BaseLlm):
    async def generate_content_async(self, llm_request, stream=False):
        await asyncio.Event().wait()
        yield  # pragma: no cover


class TestRuntimeIsolation(unittest.TestCase):
    def setUp(self):
        self.config = AgentConfig(project_id="test-project", mcp_toolbox_url=None)

    def test_default_builds_do_not_share_runtime_or_legacy_override(self):
        legacy = HeatResilienceRuntime(replace(self.config, project_id="legacy-project"))
        with using_runtime(legacy), patch.dict("os.environ", {"GOOGLE_CLOUD_PROJECT": "fresh-project"}):
            first = build_agent()
            second = build_agent()
            self.assertIsNot(first._runtime, second._runtime)
            self.assertIsNot(first._runtime, legacy)
            self.assertEqual(first._runtime.config.project_id, "fresh-project")
            self.assertIs(get_runtime(), legacy)

    def test_nested_runtime_restores_after_failure(self):
        first = HeatResilienceRuntime(self.config)
        second = HeatResilienceRuntime(replace(self.config, project_id="other-project"))
        with using_runtime(first):
            with self.assertRaises(RuntimeError), using_runtime(second):
                self.assertIs(get_runtime(), second)
                raise RuntimeError("failure")
            self.assertIs(get_runtime(), first)

    def test_threaded_agents_and_nested_tools_never_cross_clients(self):
        barrier = threading.Barrier(2)

        @tool_boundary
        def inner():
            get_runtime().query_rows("SELECT 1")
            return {"project": get_runtime().project_id}

        @tool_boundary
        def outer():
            barrier.wait(timeout=5)
            return inner()

        runtimes = [
            HeatResilienceRuntime(replace(self.config, project_id=project), MagicMock())
            for project in ("first-project", "second-project")
        ]
        for runtime in runtimes:
            runtime._client.query.return_value = query_job()
        wrappers = [_configured_tool(outer, runtime) for runtime in runtimes]

        def run(index):
            unrelated = HeatResilienceRuntime(replace(self.config, project_id="legacy-project"))
            set_runtime(unrelated)
            result = wrappers[index]()
            self.assertIs(get_runtime(), unrelated)
            return result

        with self.assertLogs("agent.telemetry"), ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(run, range(2)))
        self.assertEqual([row["project"] for row in results], ["first-project", "second-project"])
        for runtime in runtimes:
            runtime._client.query.assert_called_once()

    def test_legacy_selection_is_thread_local(self):
        barrier = threading.Barrier(2)

        def run(project):
            runtime = HeatResilienceRuntime(replace(self.config, project_id=project))
            set_runtime(runtime)
            barrier.wait(timeout=5)
            return get_runtime().project_id

        with ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(
                list(executor.map(run, ["first-project", "second-project"])),
                ["first-project", "second-project"],
            )


class TestQueryTelemetry(unittest.TestCase):
    def setUp(self):
        self.client = MagicMock()
        self.job = query_job(rows=[{"value": 1}])
        self.client.query.return_value = self.job
        self.runtime = HeatResilienceRuntime(
            AgentConfig(project_id="test-project", mcp_toolbox_url=None), self.client
        )

    def test_success_reports_usage_and_safe_job_labels(self):
        with self.assertLogs("agent.telemetry") as captured, correlation(
            invocation_id="invocation-test", conversation_id="conversation-test"
        ):
            result = self.runtime.query_rows("SELECT 'SECRET SQL'", None)
        self.assertEqual(result, [{"value": 1}])
        events = records(captured)
        submitted = next(row for row in events if row["event"] == "bigquery.submitted")
        finished = events[-1]
        self.assertEqual(submitted["job_id"], finished["job_id"])
        self.assertEqual(finished["status"], "OK")
        self.assertEqual(finished["bytes_billed"], 1024)
        self.assertEqual(finished["bytes_processed"], 512)
        self.assertEqual(finished["slot_ms"], 23)
        self.assertFalse(finished["cache_hit"])
        self.assertEqual(finished["row_count"], 1)
        self.assertIsNone(finished["cost_usd"])
        self.assertGreaterEqual(finished["duration_ms"], 0)
        labels = self.client.query.call_args.kwargs["job_config"].labels
        self.assertEqual(labels["agent_span"], finished["span_id"])
        self.assertEqual(labels["agent_runtime"], self.runtime.runtime_id)
        self.assertNotIn("SECRET", "\n".join(captured.output))

    def test_permission_failure_before_submission_has_no_fake_usage_or_job(self):
        self.client.query.side_effect = Forbidden("SECRET SQL/token/coordinates")
        with self.assertLogs("agent.telemetry") as captured, self.assertRaises(Forbidden):
            self.runtime.query_rows("SECRET SQL")
        event = records(captured)[-1]
        self.assertEqual(event["status"], "ERROR")
        self.assertEqual(event["category"], "PERMISSION")
        self.assertIsNone(event["job_id"])
        self.assertIsNone(event["bytes_billed"])
        self.assertNotIn("SECRET", "\n".join(captured.output))

    def test_timeout_keeps_job_id_and_records_cancellation_failure(self):
        self.job.result.side_effect = TimeoutError("SECRET timeout")
        self.job.cancel.side_effect = Forbidden("SECRET cancel")
        with self.assertLogs("agent.telemetry") as captured, self.assertRaises(TimeoutError):
            self.runtime.query_rows("SECRET SQL")
        event = records(captured)[-1]
        self.assertEqual(event["job_id"], "job-test")
        self.assertEqual(event["category"], "TIMEOUT")
        self.assertEqual(event["status"], "ERROR")
        self.assertIn("bigquery.cancel_failed", [row["event"] for row in records(captured)])
        self.assertNotIn("SECRET", "\n".join(captured.output))

    def test_unknown_statistics_remain_null_and_preserve_existing_labels(self):
        self.job.total_bytes_billed = None
        self.job.total_bytes_processed = None
        self.job.slot_millis = None
        self.job.cache_hit = None
        from google.cloud import bigquery
        config = bigquery.QueryJobConfig(labels={"owner": "heat"})
        with self.assertLogs("agent.telemetry") as captured:
            self.runtime.query_rows("SELECT 1", config)
        event = records(captured)[-1]
        for key in ("bytes_billed", "bytes_processed", "slot_ms", "cache_hit"):
            self.assertIsNone(event[key])
        self.assertEqual(config.labels["owner"], "heat")

    def test_reused_job_config_cannot_retain_another_invocation_label(self):
        from google.cloud import bigquery
        config = bigquery.QueryJobConfig()
        with self.assertLogs("agent.telemetry"), correlation(invocation_id="old-turn"):
            self.runtime.query_rows("SELECT 1", config)
        first_span = config.labels["agent_span"]
        self.assertIn("agent_invocation", config.labels)
        with self.assertLogs("agent.telemetry"):
            self.runtime.query_rows("SELECT 1", config)
        self.assertNotIn("agent_invocation", config.labels)
        self.assertNotEqual(config.labels["agent_span"], first_span)


class TestAdkTelemetry(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.config = AgentConfig(project_id="test-project", mcp_toolbox_url=None)
        self.agent = build_agent(self.config)
        self.agent.model = ToolCallingModel(model="offline-model")
        self.client = MagicMock()
        self.client.query.side_effect = lambda *a, **k: query_job(
            job_id=k["job_config"].labels["agent_span"]
        )
        self.agent._runtime._client = self.client
        self.sessions = InMemorySessionService()
        self.runner = Runner(
            app_name="heat_test", agent=self.agent, session_service=self.sessions,
        )

    async def invoke(self, session_id, runner=None):
        await self.sessions.create_session(
            app_name="heat_test", user_id="SECRET-user", session_id=session_id,
        )
        return [
            event async for event in (runner or self.runner).run_async(
                user_id="SECRET-user", session_id=session_id,
                new_message=types.Content(role="user", parts=[types.Part(text="SECRET prompt")]),
            )
        ]

    async def test_real_runner_correlates_conversation_tool_and_query(self):
        with self.assertLogs("agent.telemetry") as captured:
            events = await self.invoke("SECRET-session")
        rows = records(captured)
        invocation = next(row for row in rows if row["event"] == "invocation.finished")
        tool = next(row for row in rows if row["event"] == "tool.finished")
        query = next(row for row in rows if row["event"] == "bigquery.finished")
        self.assertEqual(invocation["status"], "OK")
        self.assertEqual(tool["status"], "ERROR")  # Empty evidence, not an execution crash.
        self.assertEqual(query["status"], "OK")
        self.assertEqual(tool["parent_span_id"], invocation["span_id"])
        self.assertEqual(query["parent_span_id"], tool["span_id"])
        self.assertEqual(tool["tool_call_id"], "call-test")
        self.assertEqual(invocation["total_tokens"], 14)
        self.assertEqual(invocation["prompt_tokens"], 10)
        self.assertEqual(invocation["output_tokens"], 4)
        self.assertTrue(events[-1].is_final_response())
        self.assertEqual(len({row["invocation_id"] for row in rows}), 1)
        self.assertEqual(len({row["conversation_id"] for row in rows}), 1)
        self.assertNotIn("SECRET", "\n".join(captured.output))

    async def test_concurrent_sessions_on_same_agent_do_not_cross_correlations(self):
        with self.assertLogs("agent.telemetry") as captured:
            await asyncio.gather(self.invoke("session-a"), self.invoke("session-b"))
        rows = records(captured)
        conversations = {
            conversation_id("heat_test", "SECRET-user", session) for session in ("session-a", "session-b")
        }
        self.assertEqual({row["conversation_id"] for row in rows}, conversations)
        for identity in conversations:
            group = [row for row in rows if row["conversation_id"] == identity]
            self.assertEqual(len({row["invocation_id"] for row in group}), 1)
            self.assertEqual(sum(row["event"] == "invocation.finished" for row in group), 1)
            self.assertEqual(sum(row["event"] == "bigquery.finished" for row in group), 1)
        with self.assertLogs("agent.telemetry") as fresh, span("probe"):
            pass
        self.assertNotIn("conversation_id", records(fresh)[0])

    async def test_model_failure_records_terminal_error_without_provider_details(self):
        self.agent.model = FailingModel(model="offline-model")
        with self.assertLogs("agent.telemetry") as captured, self.assertRaises(RuntimeError):
            await self.invoke("session-error")
        finished = records(captured)[-1]
        self.assertEqual(finished["event"], "invocation.finished")
        self.assertEqual(finished["status"], "ERROR")
        self.assertIsNone(finished["total_tokens"])
        self.assertNotIn("SECRET", "\n".join(captured.output))

    async def test_two_agents_run_concurrently_with_distinct_projects_and_clients(self):
        other = build_agent(replace(self.config, project_id="other-project"))
        other.model = ToolCallingModel(model="offline-model")
        other_client = MagicMock()
        other_client.query.return_value = query_job("other-job")
        other._runtime._client = other_client
        runner = Runner(app_name="heat_test", agent=other, session_service=self.sessions)
        with self.assertLogs("agent.telemetry") as captured:
            await asyncio.gather(
                self.invoke("session-first"),
                self.invoke("session-other", runner),
            )
        self.assertIn("test-project.", self.client.query.call_args.args[0])
        self.assertIn("other-project.", other_client.query.call_args.args[0])
        jobs = [row for row in records(captured) if row["event"] == "bigquery.finished"]
        self.assertEqual(len(jobs), 2)
        self.assertEqual(
            {(row["project_id"], row["runtime_id"]) for row in jobs},
            {("test-project", self.agent._runtime.runtime_id), ("other-project", other._runtime.runtime_id)},
        )

    async def test_cancelled_invocation_records_terminal_status_and_restores_context(self):
        self.agent.model = BlockingModel(model="offline-model")
        with self.assertLogs("agent.telemetry") as captured:
            task = asyncio.create_task(self.invoke("session-cancelled"))
            for _ in range(100):
                if any(row["event"] == "invocation.started" for row in records(captured)):
                    break
                await asyncio.sleep(0)
            self.assertTrue(any(row["event"] == "invocation.started" for row in records(captured)))
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertEqual(records(captured)[-1]["status"], "CANCELLED")

    async def test_actual_function_tool_injects_context_but_hides_it_from_model(self):
        @tool_boundary
        def probe():
            return {"project": get_runtime().project_id}

        wrapped = FunctionTool(_configured_tool(probe, self.agent._runtime))
        declaration = wrapped._get_declaration()
        schema = declaration.parameters_json_schema or {}
        self.assertNotIn("tool_context", schema.get("properties", {}))
        from google.adk.agents.invocation_context import InvocationContext
        session = await self.sessions.create_session(
            app_name="heat_test", user_id="user", session_id="session-context",
        )
        ctx = ToolContext(
            InvocationContext(
                invocation_id="invoke-context", agent=self.agent,
                session=session, session_service=self.sessions,
            ),
            function_call_id="call-context",
        )
        with self.assertLogs("agent.telemetry") as captured:
            result = await wrapped.run_async(args={}, tool_context=ctx)
        self.assertEqual(result["project"], "test-project")
        self.assertEqual(records(captured)[-1]["tool_call_id"], "call-context")


if __name__ == "__main__":
    unittest.main()
