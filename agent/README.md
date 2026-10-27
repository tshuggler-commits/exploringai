# Atlanta Heat Resilience Advisor (ADK Agent)

**Track:** Challenge 1 - Urban Climate Resilience & Walkability  
**Target City:** Atlanta, GA  
**Powered by:** Google Agent Development Kit (ADK), Gemini 2.5 Flash on Vertex AI, BigQuery ML (`LINEAR_REG` with `ML.EXPLAIN_PREDICT`).

---

## 1. Overview & Architecture

The **Atlanta Heat Resilience Advisor** assists municipal decision-makers (city planners, emergency managers, City Council) in siting cooling centers, prioritizing climate investments, explaining heat disparities, and conducting climate equity audits.

### Core Architecture
- **Reasoning Engine:** Gemini 2.5 Flash via Google ADK (`google-adk`) configured on Vertex AI.
- **Predictive Engine:** The production serving agent (MODEL_FAMILY=atlanta) uses BigQuery ML model qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_offset_model, trained from the Atlanta Heat Watch campaign and Census tract features. Station tables provide temporal context separately; they are not training examples for the spatial offset model. (An optional extended planning family MODEL_FAMILY=planning is supported for experimental heat_planning_model evaluation).
- **Explainability:** Employs `ML.EXPLAIN_PREDICT` to extract feature attributions (structure age, latitude, transit dependency, poverty rates) rather than black-box estimates.
- **Scope & Safety:** Calibrated strictly for Atlanta; refuses inquiries outside municipal bounds.

---

## 2. Tools & Capabilities

The agent exposes one tool family per instance: 9 Atlanta tools by default, or
4 extended planning tools when explicitly configured.

1. `predict_heat_offset_and_explain(latitude, longitude, tract_id, baseline_forecast_f)`
   - Predicts localized microclimate heat offset (°F) and computes localized temperatures against any forecast.
   - Extracts top-3 feature attributions explaining *why* the microclimate is warmer.

2. `compare_locations_and_explain(lat1, lon1, label1, lat2, lon2, label2)`
   - Computes spatial temperature differentials between two coordinates (e.g. South Pryor St vs. Piedmont Park).
   - Breaks down the comparative structural drivers.

3. `compare_census_tracts(tract_id_1, tract_id_2)`
   - Provides side-by-side trade-off evaluations between two Census tracts.
   - Contrasts acute vulnerability (poverty & vehicle deprivation) against aggregate population scale.

4. `rank_cooling_center_sites(top_n, focus_criteria)`
   - Calculates a multi-factor composite vulnerability score:
     $$\text{Composite Score} = 0.4 \times \text{Offset (°F)} + 0.3 \times \text{Poverty Rate (scaled)} + 0.3 \times \text{Transit Deprivation (scaled)}$$
   - Returns top recommended Census tracts across Atlanta.

5. `query_heat_history(min_temp_f, start_year)`
   - Analyzes multi-year GHCN daily weather station observations from 2018 to present.
   - Counts extreme heat days (e.g. $\ge 95^\circ\text{F}$) and computes summer peak temperatures.

6. `get_tract_demographics(latitude, longitude, tract_id)`
   - Retrieves population, median age, median income, housing units, housing vintage, and transit access by coordinate or GEOID.

7. `audit_equity(selected_tract_ids)`
   - Benchmarks recommended sites against the Atlanta citywide 75th percentile (top quartile) for poverty and no-vehicle rates.
   - Validates that public investments counteract historic climate inequities.

8. `recommend_canopy_interventions(top_n, min_pop_density)`
   - Ranks contextual canopy/SVI data and reports gaps to the 50% planning target.

9. `generate_council_proposal(top_n, baseline_forecast_f, funding_source)`
   - Composes rankings, feature attributions, equity findings, and canopy context.
   - Propagates missing-data/audit errors rather than claiming verification.
   - Funding and facility availability remain unverified planning assumptions.

### Extended Planning Tools

- `predict_and_explain_location(latitude, longitude)`: campaign-bound prediction,
  interpolated tract features, feature attributions, and nearby measured readings.
- `rank_cooling_sites(top_n, mode)`: explained rankings and interventions for
  `today`, `budget_cycle`, and `decade` planning.
- `audit_recommendations_equity(tract_ids)`: selected-versus-citywide differences
  in poverty, vehicle access, age, and income (complements the quartile audit).
- `get_station_heat_frequency(threshold_f)`: annual regional extreme-heat
  frequency and trend summaries.

The original Atlanta implementations remain in [`tools.py`](./tools.py).
The extended implementations live in [`planning_tools.py`](./planning_tools.py)
and are also re-exported by `tools.py`. Set `MODEL_FAMILY=atlanta` or
`MODEL_FAMILY=planning` to choose which set the `atlanta_heat_resilience_advisor`
exposes. The two sets are never registered together. A missing or incompatible
model fails explicitly; it does not select the other family.
Each registered tool is bound to its owning runtime via a scoped context, so
building another agent does not change nested calls' dataset/model configuration.
Every `build_agent()` call, including calls without configuration, creates a new
runtime with its own immutable configuration, lazy client, lock, and metadata
caches. It never adopts a runtime selected by another caller.
The direct Python `get_runtime`/`set_runtime` compatibility hooks are context-local,
not process-global. Async child tasks inherit their parent's context until they
select another runtime; registered agent tools always bind their owning runtime.
Use `using_runtime(runtime)` for temporary direct calls; nesting, exceptions, and
cancellation restore the previous context.

### Configuration and Model Compatibility

Tools within one agent share its lazily created BigQuery client configured by
[`config.py`](./config.py). Different agents do not share that runtime or its
caches. Importing the agent does not query BigQuery.

| Environment variable | Default | Purpose |
|---|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | `TRUE` for Cloud Run | Route ADK Gemini requests through Vertex AI and Cloud Run Application Default Credentials instead of requiring a Gemini Developer API key |
| `GOOGLE_CLOUD_PROJECT` / `GCP_PROJECT` | `qwiklabs-gcp-03-1578f96a5a7a` | BigQuery project |
| `GOOGLE_CLOUD_LOCATION` | deployment region | Vertex AI location for Gemini |
| `BQ_DATASET` | `a4i_climate` | Input tables and models |
| `BQ_LOCATION` | `US` | BigQuery job location |
| `MODEL_FAMILY` | `atlanta` | Register only `atlanta` or `planning` tools |
| `BQML_MODEL` | `heat_offset_model` | Existing Atlanta model; label `offset_f` |
| `BQ_MODEL_NAME` | unset | Data-lane compatibility alias, used only when `BQML_MODEL` is unset |
| `PLANNING_BQML_MODEL` | `heat_planning_model` | Extended planning model; label `heat_offset_f` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | ADK reasoning model |
| `AUTO_BOOTSTRAP_BQML` | `false` | Explicit development-only opt-in for planning-model bootstrap |
| `BBOX_PAD_DEGREES` | `0.03` | Planning prediction bounds padding |
| `EXPLAIN_TOP_K` | `4` | Planning attribution count |
| `MCP_TOOLBOX_URL` | unset | Optional MCP Toolbox endpoint |
| `BQ_QUERY_TIMEOUT_SECONDS` | `60` | Submission timeout, result-wait timeout, and server job timeout |
| `BQ_MAXIMUM_BYTES_BILLED` | `1000000000` | Per-query billing ceiling (1 GB decimal) |

**Keep the two model names distinct.** Their labels and input features differ.
Planning tools only resolve their configured model; they never discover an
arbitrary dataset model or replace the Atlanta model. The optional training
reference [`sql/bqml_model.sql`](./sql/bqml_model.sql) creates only
`qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_planning_model`; adjust its identifiers for other projects or datasets.
Do not treat outputs from the two model families as interchangeable.

Setting `MCP_TOOLBOX_URL` adds Toolbox tools to the agent. Connection or tool
loading errors propagate rather than silently disabling a configured integration.

### Tool implementation and data-lane contract

The serving reference is the `data-lane` branch at `831a7f7`. The integration
boundary is BigQuery, not Python imports from the training pipeline:

- The data plane owns training, spatial evaluation, candidate approval, promotion,
  and rollback. Atlanta tools read the configured active `BQML_MODEL`; they never
  train, discover, or promote a candidate. Keep `AUTO_BOOTSTRAP_BQML=false` in
  production; the live validation command always disables bootstrap.
- [`sql/clean_tracts.sql`](./sql/clean_tracts.sql) mirrors that branch's
  `data_plane/sql/clean_tracts.sql`. Prediction and Atlanta ranking reuse the same
  sentinel handling, fixed imputations, valid-coordinate filtering, and
  reference-year rule. Inference supplies the current UTC time as `reference_time`.
  Update this serving copy and its contract tests when the training contract changes.
- The Atlanta model consumes exactly eight features: latitude, longitude, income,
  poverty rate, no-vehicle rate, median age, housing units, and structure vintage.
  Canopy/SVI analysis tables are contextual joins, not additional prediction inputs.
  The nine Atlanta tools require `atlanta_canopy_heat_svi_modeling` for that context.
  Atlanta rankings use `ML.EXPLAIN_PREDICT` so proposal drivers come from actual
  model attributions. Optional `model_name` overrides on prediction, ranking, and
  comparison Python functions accept only simple model names in the configured
  dataset. Agent-facing adapters remove that parameter from the actual ADK
  schemas and reject attempts to override the configured model.
- [`HeatResilienceRuntime.query_rows`](./planning_tools.py) is the execution boundary
  for both toolsets, including metadata and optional planning bootstrap queries.
  It applies cost and deadline limits, logs job ID/billed bytes/row count, and
  attempts cancellation after a result timeout. Cancellation is best-effort;
  submission and result waits have separate deadlines, not one end-to-end deadline.
  Query failures are logged and propagated; existing planning tools translate
  failures into their error responses. No application-level retry loop is added.
- Values use typed query parameters. Configured resource identifiers are validated
  separately, since SQL identifiers cannot be query parameters.
- Every public tool returns `status: OK` or `status: ERROR`. Success retains the
  existing payload fields. Errors include `error_code`, `category`, `error`,
  `message`, and `retryable`; categories distinguish `INVALID_INPUT`,
  `OUT_OF_BOUNDS`, `NO_DATA`, `PERMISSION`, `TIMEOUT`, `QUERY`, `CONTRACT`,
  `UNAVAILABLE`, and `INTERNAL`. Logs retain error codes and exception class names,
  not provider messages/tracebacks that can contain SQL, parameters, or credentials.
  Composite tools preserve the upstream error category.
- Both prediction families validate fresh BigQuery model metadata before inference:
  the exact feature set, a numeric family-specific label, numeric feature types,
  and linear-regression model kind. BigQuery `StandardSqlField` metadata is used,
  not table `SchemaField` objects. Label spellings are explicitly allowlisted:
  `offset_f`/`predicted_offset_f` for Atlanta and
  `heat_offset_f`/`predicted_heat_offset_f` for planning. Arbitrary `predicted_*`
  output columns are never accepted.
- Prediction/ranking responses include model family and observed metadata etag.
  The etag is checked before querying, not an immutable snapshot or a guarantee
  against a concurrent model promotion.
- Empty rankings/history, missing explanations, nonfinite predictions, incomplete
  selected-tract audits, and null audit metrics cannot produce successful evidence.
  Documented training imputations remain intentional; absent audit evidence is
  not imputed. Regional trends require at least two adequately observed years;
  one year returns an explicit `INSUFFICIENT_HISTORY` direction and null trend
  values. No adequately observed years returns an error.

### Planner-facing presentation

Both agent families use concise decision summaries and separate campaign-relative
offsets from vulnerability, historical campaign temperatures, and forecast scenarios.
Rankings are screening candidates, not verified facilities, served populations or
measured walking routes. Next steps use plain language rather than Python syntax.
Planning attribution `direction` values are `increases_prediction`,
`decreases_prediction`, or `neutral` (replacing the causal-sounding legacy
`warming_driver`/`cooling_mitigator`). Formatted explanations describe model
contributions as associations, not causal physical effects. The legacy
`why_it_is_hot` payload key remains for compatibility, with noncausal wording.
The custom frontend's evidence cards require successful structured tool payloads;
deploy the frontend and agent changes separately to update both experiences.

### Correlated execution telemetry

[`telemetry.py`](./telemetry.py) emits one-line JSON to stderr, captured as
structured logs by Cloud Run without a new logging dependency or root-logger
configuration. Telemetry is enabled at INFO independently of ADK's log level.
Text/API conversations through the built agent produce:

| Events | Safe fields |
|---|---|
| `invocation.started` / `invocation.finished` | Conversation hash, ADK invocation ID, runtime ID, model family, duration, execution status, reported LLM token usage |
| `tool.started` / `tool.finished` | Tool name, ADK function-call ID, span/parent-span IDs, duration, tool status, error category/code |
| `bigquery.started` / `bigquery.submitted` / `bigquery.finished` | Same correlation, job ID, execution project/location, duration, row count, billed/processed bytes, slot-ms, cache hit, outcome |

`conversation_id` is a deterministic SHA-256 pseudonym of application, user, and
session IDs; raw user/session IDs are not logged. The invocation ID separates
turns in that conversation. Local span IDs distinguish parallel tools and nested
composite-tool calls. BigQuery job labels `agent_runtime`, `agent_span`, and
`agent_invocation` (hashed invocation ID) support joining job metadata to logs.
Existing non-agent job labels are preserved.

Invocation `OK` means execution completed, **not** that every tool found evidence.
Inspect each tool's status/category: a query can execute successfully while its
tool returns `NO_DATA`, and the agent can then explain the limitation successfully.
Failures and cancelled/closed invocation streams emit terminal events and restore
scoped context. Native `run_live` audio/video is not instrumented by this
text/API invocation wrapper.

Cost fields are **usage, not an invoice**: BigQuery reports billed bytes and
slot-ms, while invocation summaries aggregate provider-reported prompt, output,
total, cached, and thinking tokens across non-partial model events.
`cost_usd` is null and `cost_status` is `USAGE_ONLY`; reservation pricing, BQML
pricing, model pricing, and billing adjustments are not guessed. Unknown
statistics remain null, including token counts when no usage was reported.
Failed or cancelled jobs may expose only partial statistics; use billing export
for monetary reconciliation and authoritative final cost.

No prompts, responses, tool arguments, coordinates, tract lists, SQL, query
parameters, credentials, or raw exception messages are emitted by these events.
Direct Python tools have spans but no fabricated conversation identity.
Optional remote Toolbox tools do not pass through the local tool/BigQuery
instrumentation; their backend requires separate tracing. Third-party ADK/SDK
logging is separate; avoid debug/payload logging in production.

Example Cloud Logging filter (substitute IDs from a terminal event):

```text
resource.type="cloud_run_revision"
resource.labels.service_name="atlanta-heat-advisor"
jsonPayload.invocation_id="INVOCATION_ID"
```

Filter `jsonPayload.conversation_id` for multiple turns, or
`jsonPayload.job_id` to locate a particular BigQuery job. These filters become
available only after deploying this version; health/readiness alone does not
verify BigQuery or Vertex permissions.

Intentional validation changes: Atlanta coordinates must be finite and inside the
documented metro rectangle (latitude 33.55-34.02, longitude -84.60 to -84.15).
This rectangle is a coarse scope guard, not a municipal polygon or proof of model
support at every point. Rankings accept integer limits 1-20; unknown criteria/modes
are rejected rather than ignored. Planning mode aliases remain accepted. Equity
audits accept at most 100 IDs; Atlanta audits deduplicate IDs and reject incomplete
matches instead of reporting a complete audit for a partial selection.
Planning audits also reject partial matches and missing baseline/selection metrics.

Atlanta `pure_heat` rankings now order by heat offset; the default keeps the
existing composite score. Station history includes observed years with zero
threshold exceedances and computes summer averages over all June-August readings,
not just hot days. Years with no observations are not synthesized.
The legacy `predicted_surface_temp_f` field is retained for compatibility, but is
only baseline-plus-offset arithmetic, not a surface-temperature measurement.
The default 102 F baseline is a scenario assumption, not a fetched forecast.

### Live model readiness check

From the repository root, using the same ADC identity as the runtime:

```bash
# Metadata only; no prediction queries.
python -m agent.validate_models --family all

# Read-only prediction/explanation and ranking smoke tests, with shared query limits.
python -m agent.validate_models --family all --execute

# Explicit diagnostic alternative: use the already authenticated gcloud CLI identity.
# This does not change ADC and is never an automatic runtime fallback.
python -m agent.validate_models --family all --execute --credential-source gcloud
```

The command emits JSON and exits nonzero if any requested family fails. It never
trains/promotes a model. `--family atlanta` checks just the default serving family.
The CLI identity option requires `gcloud`; production continues to use ADC.

Live verification on 2026-10-27 found:

- ADC: `bigquery.models.getMetadata` denied for both configured resources.
- Explicit gcloud identity: Atlanta's eight FLOAT64 features, numeric
  `predicted_offset_f` label, prediction/explanation, and top-one ranking passed.
- That identity received `404 NotFound` for `heat_planning_model`; planning
  inference remains unverified and is not enabled by default.
- Additional CLI-identity checks passed for Atlanta demographics, quartile
  equity, station history, location/tract comparisons, canopy recommendations,
  council proposal generation, and regional station frequency. The detailed
  planning equity audit correctly returned `INCOMPLETE_EQUITY_DATA` because
  the selection or citywide baseline has missing metrics; no verdict was invented.

Do not treat a successful CLI-identity smoke test as proof that the deployed
service account has access. Verify `roles/bigquery.dataViewer` on the dataset and
`roles/bigquery.jobUser` on the execution project for the actual runtime identity.

---

## 3. Local Development & Testing

From the repository root:

```bash
python -m pip install -r agent/requirements.txt
python -m unittest discover -s agent/tests -p 'test_*.py'
```

For Vertex AI, set `GOOGLE_GENAI_USE_VERTEXAI=TRUE`, `GOOGLE_CLOUD_PROJECT`,
and `GOOGLE_CLOUD_LOCATION`, and configure Application Default Credentials.
Cloud Run deployment sets Vertex AI mode explicitly and uses the runtime service
account's credentials; do not add a Gemini Developer API key to the service.
For local container testing:

```bash
docker build -f agent/Dockerfile -t atlanta-heat-advisor .
```

### Running Queries via CLI
```bash
# Siting recommendations
adk run agent "We have funding for 3 cooling centers. Where should they go?"

# Disparities and Explainability
adk run agent "Why is South Pryor St hotter than Piedmont Park?"

# Historical station trends
adk run agent "How often does Atlanta hit 95°F? Is it getting worse?"

# Tradeoff comparison
adk run agent "Compare Census Tract 13121006802 versus Tract 13121007808."

# Equity audit
adk run agent "Audit the equity of cooling centers in tracts 13121006802, 13121007808, and 13121007603."
```

### Launching the Web UI & API Server
```bash
adk web --port 8080 .
```

---

## 4. Live Cloud Run Deployment & Front-End Integration

### Live Endpoints
- **Frontend Dashboard (Cloud Run):** [https://atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app](https://atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app)
- **Agent API / ADK Web:** [https://atlanta-heat-advisor-1004921377034.us-central1.run.app](https://atlanta-heat-advisor-1004921377034.us-central1.run.app)
- **Health Check:** `GET /health` -> `{"status":"ok"}`
- **List Agents:** `GET /list-apps` -> `["agent"]`
- **Agent Run API:** `POST /run` (JSON body with user query)
- **Streaming API:** `POST /run_sse` (Server-sent events for streaming UI)

The ADK server explicitly allows requests from the deployed frontend origins and
the documented local development origins in [`Dockerfile`](./Dockerfile). If the
frontend hostname or development port changes, update that origin allowlist and
redeploy the agent.

### Local Dev Alternative
```bash
adk web --port 8080 .
```

### Automated Cloud Build Deployment

The repository-root [`cloudbuild.yaml`](../cloudbuild.yaml) runs unit tests in the built
container, publishes an immutable image digest to Artifact Registry, then deploys and promotes
a ready Cloud Run revision. The pipeline defaults to private access at the IAM layer. See
[`scripts/README.md`](../scripts/README.md#building-and-deploying-the-agent) for project IAM
setup, required service accounts, and the submission command.
