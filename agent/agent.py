"""
City of Atlanta Heat Resilience Planning Assistant
Built with Google Agent Development Kit (ADK), Gemini, and BigQuery ML.
"""

from typing import Any
import inspect
from functools import wraps
from collections.abc import AsyncGenerator
from contextlib import aclosing

from google.adk.agents.llm_agent import Agent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.adk.tools import ToolContext
from pydantic import PrivateAttr
from .config import AgentConfig
from .prompts import SYSTEM_INSTRUCTION as PLANNING_SYSTEM_INSTRUCTION
from .planning_tools import using_runtime
from .telemetry import correlation, conversation_id, span
from .tools import (
    CUSTOM_HEAT_TOOLS,
    HeatResilienceRuntime,
    predict_heat_offset_and_explain,
    compare_locations_and_explain,
    compare_census_tracts,
    rank_cooling_center_sites,
    query_heat_history,
    get_tract_demographics,
    audit_equity,
    recommend_canopy_interventions,
    generate_council_proposal,
)

SYSTEM_INSTRUCTION = """
You are the Senior Climate Resilience Advisor for the City of Atlanta's Office of Sustainability and Emergency Management.
Your mandate is to assist municipal decision-makers (city planners, emergency directors, city council members) in allocating heat mitigation resources, siting cooling centers, and evaluating climate equity during extreme heat emergencies.

### CORE OPERATING PRINCIPLES:
1. DATA-GROUNDED AND PRECISE: Base all quantitative claims on the data tools provided. Do not invent temperatures, demographic figures, or statistical correlations.
2. PREDICT OFFSETS, NOT RAW TEMPERATURES: Always frame spatial heat predictions as an *offset relative to the citywide baseline* (e.g., "+3.4°F hotter than city average"). When given a baseline forecast (such as 102°F), calculate the localized microclimate temperature by adding the offset (e.g., 105.4°F).
3. EXPLAIN THE 'WHY' WITH FEATURE ATTRIBUTIONS: When explaining a prediction, cite only the feature attributions actually returned by `ML.EXPLAIN_PREDICT`. Treat them as predictive associations, not proof of causal heat mechanisms; do not claim pavement or canopy are model inputs unless the model schema confirms that.
4. GEOGRAPHIC SCOPE & REFUSAL: You are strictly scoped to the City of Atlanta and its immediate metro area. If a user asks about another city (e.g. Dallas, New York, Chicago) or topics outside urban heat and municipal resilience, refuse politely and firmly: "I am specifically calibrated for the City of Atlanta heat resilience and climate planning dataset. I cannot provide assessments for other jurisdictions."

### HOW TO ADDRESS THE 8 CORE PLANNER QUESTIONS:
1. Siting Cooling Centers ("We can fund N cooling centers. Where should they go?"):
   - Call `rank_cooling_center_sites`.
   - Provide the specific coordinates, census tract, predicted temperature offset, poverty rate, and no-vehicle rate for each site.
   - Explain that priority is given to locations combining high thermal exposure with low mobility and economic resources.

2. Explaining Disparities ("Why is site A worse than site B?"):
   - Call `compare_locations_and_explain` or `predict_heat_offset_and_explain`.
   - Highlight the offset differential and returned feature associations. Do not invent canopy or impervious-surface inputs or infer physical causes from socioeconomic associations.

3. Historical Heat Trends ("How often does this hit dangerous levels? Is it getting worse?"):
   - Call `query_heat_history` with appropriate thresholds (90°F, 95°F, or 100°F).
   - Summarize the multi-year trajectory, noting high-risk summers and frequency of extreme days.

4. Neighborhood Demographics ("Who lives around that site?"):
   - Call `get_tract_demographics`.
   - Report total population, median age, no-vehicle rate, poverty rate, and housing age to contextualize human vulnerability.

5. Weighing Tradeoffs ("Down to two sites—make the case for each"):
   - Compare both sites using their predictions and demographics.
   - Contrast immediate acute vulnerability (e.g. high transit poverty / elderly) versus broader aggregate coverage (e.g. higher overall population).

6. Drafting Council Proposals ("Draft the proposal for city council"):
   - Call `generate_council_proposal` for verified rankings, equity, and canopy context.
   - Synthesize the site rankings, predicted temperatures, and demographics into a formal municipal policy memorandum.
   - Include: Executive Summary, Recommended Siting Locations & Evidence, Operational Requirements (hydration, hours, transit), and Equity Justification.

7. Equity Audit ("Did we actually reach the neighborhoods that need this most?"):
   - Call `audit_equity` with the proposed tract IDs.
   - Clearly report whether the recommendations land in the top 25% (highest quartile) of citywide poverty and no-vehicle rates, validating that city investments counteract systemic climate disparities.
   - Keep the audit separate from heat prediction: race and ethnicity are excluded from model inputs, while economic tract features may be model inputs. Do not claim that all demographic or socioeconomic data was removed, or that audit metrics caused a heat prediction.

8. Urban Forestry & Tree Canopy Planning ("Where should we plant trees?"):
   - Call `recommend_canopy_interventions` for priority tracts and canopy gaps.
   - Keep measured canopy context separate from prediction inputs; never invent intervention temperature reductions.

Maintain a professional, authoritative, and actionable tone suitable for presentation to the Mayor and City Council.
"""

class ObservableAgent(Agent):
    """Keep invocation state local and record lifecycle even on failure or cancellation."""

    _runtime: HeatResilienceRuntime = PrivateAttr()

    async def run_async(self, parent_context: InvocationContext) -> AsyncGenerator[Event, None]:
        session = parent_context.session
        with using_runtime(self._runtime), correlation(
            runtime_id=self._runtime.runtime_id,
            model_family=self._runtime.config.model_family,
            conversation_id=conversation_id(session.app_name, session.user_id, session.id),
            invocation_id=parent_context.invocation_id,
        ), span("invocation") as observation:
            observation.fields.update(
                prompt_tokens=None, output_tokens=None, total_tokens=None,
                cached_tokens=None, thought_tokens=None,
                usage_status="UNAVAILABLE", cost_usd=None, cost_status="USAGE_ONLY",
            )
            async with aclosing(super().run_async(parent_context)) as events:
                async for event in events:
                    if event.error_code:
                        observation.fields.update(status="ERROR", error_code="MODEL_ERROR")
                    usage = event.usage_metadata
                    if usage is not None and not event.partial:
                        observation.fields["usage_status"] = "REPORTED"
                        for field, value in (
                            ("prompt_tokens", usage.prompt_token_count),
                            ("output_tokens", usage.candidates_token_count),
                            ("total_tokens", usage.total_token_count),
                            ("cached_tokens", usage.cached_content_token_count),
                            ("thought_tokens", usage.thoughts_token_count),
                        ):
                            if value is not None:
                                observation.fields[field] = (
                                    observation.fields[field] or 0
                                ) + value
                    yield event


def _configured_tool(function: Any, runtime: HeatResilienceRuntime) -> Any:
    """Keep candidate selection out of the LLM schema while retaining the Python API."""
    signature = inspect.signature(function)
    model_kwargs = (
        {"model_name": runtime.config.bqml_model_name}
        if "model_name" in signature.parameters else {}
    )
    @wraps(function)
    def invoke(*args: Any, tool_context: ToolContext | None = None, **kwargs: Any) -> Any:
        context_fields: dict[str, Any] = {}
        if tool_context is not None:
            session = tool_context.session
            context_fields = {
                "conversation_id": conversation_id(session.app_name, session.user_id, session.id),
                "invocation_id": tool_context.invocation_id,
                "tool_call_id": tool_context.function_call_id,
            }
        with using_runtime(runtime), correlation(
            runtime_id=runtime.runtime_id, model_family=runtime.config.model_family,
            **context_fields,
        ):
            if "model_name" in kwargs:
                from .contracts import failure
                with span("tool", tool_name=function.__name__) as observation:
                    result = failure(
                        "MODEL_OVERRIDE_DISABLED", "The agent's model is fixed by configuration.", "INVALID_INPUT"
                    )
                    observation.result(dict(result))
                    return result
            return function(*args, **kwargs, **model_kwargs)

    invoke.__signature__ = signature.replace(  # type: ignore[attr-defined]
        parameters=[
            *[p for name, p in signature.parameters.items() if name != "model_name"],
            inspect.Parameter(
                "tool_context", inspect.Parameter.KEYWORD_ONLY,
                default=None, annotation=ToolContext,
            ),
        ]
    )
    invoke.__doc__ = "\n".join(
        line for line in (function.__doc__ or "").splitlines()
        if not line.strip().startswith("model_name:")
    )
    return invoke


def build_agent(config: AgentConfig | None = None) -> Agent:
    """Expose exactly one configured model family, with no fallback."""
    runtime = HeatResilienceRuntime(config=config)
    active_config = runtime.config
    atlanta_tools = [
        predict_heat_offset_and_explain,
        compare_locations_and_explain,
        compare_census_tracts,
        rank_cooling_center_sites,
        query_heat_history,
        get_tract_demographics,
        audit_equity,
        recommend_canopy_interventions,
        generate_council_proposal,
    ]
    if active_config.model_family == "atlanta":
        tools: list[Any] = [_configured_tool(tool, runtime) for tool in atlanta_tools]
        instruction = SYSTEM_INSTRUCTION
        selected_model = active_config.bqml_model_name
    else:
        tools = [_configured_tool(tool, runtime) for tool in CUSTOM_HEAT_TOOLS]
        instruction = PLANNING_SYSTEM_INSTRUCTION
        selected_model = active_config.planning_bqml_model_name
    instruction += (
        f"\nACTIVE MODEL FAMILY: {active_config.model_family}. "
        f"Configured model: {selected_model}. Use only the registered tools. "
        "Never blend or directly compare predictions from different model families. "
        "Never fall back to another model or infer success from unavailable evidence. "
        "Every tool returns status OK or ERROR. On ERROR, report the error category and "
        "missing evidence; do not invent replacement figures or draft a verified proposal. "
        "Economic tract features may still be prediction inputs. Interpret feature "
        "attributions as predictive associations rather than causal proof. "
        "Race and ethnicity are excluded; this does not establish fairness by itself."
        "\nPLANNER RESPONSE PRESENTATION: Start with a short decision summary, then "
        "report the ranked census tracts and key evidence. These are screening candidates, "
        "not verified buildings or operating cooling centers. Do not invent facility names, "
        "capacity, walk times or coverage. A ten-minute walk is a planning target, not a "
        "measured route. Separate thermal offsets from vulnerability and population. "
        "Describe feature attributions as predictive model associations, never physical "
        "warming drivers or causal effects of poverty/car ownership. Campaign-day "
        "temperatures are historical context, not today's forecast or heat index; omit "
        "absolute temperatures unless requested and label the baseline/date explicitly. "
        "End with a plain-language next action such as 'Audit these recommended tracts'; "
        "do not ask the user to call Python functions or expose internal tool syntax. "
        "Do not claim an equity audit passed until its actual result is available."
    )
    if active_config.mcp_toolbox_url:
        from toolbox_core import ToolboxSyncClient

        toolbox = ToolboxSyncClient(active_config.mcp_toolbox_url)
        tools.extend(toolbox.load_toolset())
    agent = ObservableAgent(
        model=active_config.gemini_model,
        name="atlanta_heat_resilience_advisor",
        description="A municipal heat resilience planning assistant for the City of Atlanta.",
        instruction=instruction,
        tools=tools,
    )
    agent._runtime = runtime
    return agent


root_agent = build_agent()
