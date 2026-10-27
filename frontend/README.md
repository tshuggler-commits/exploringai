# Atlanta Urban Climate & Heat Resilience Dashboard (Frontend Lane)

**Challenge:** Challenge 1 - Urban Climate Resilience & Walkability  
**Target City:** Atlanta, GA  
**Track:** Frontend Lane  
**Integration:** Connected directly to deployed Cloud Run ADK Agent ([https://atlanta-heat-advisor-1004921377034.us-central1.run.app](https://atlanta-heat-advisor-1004921377034.us-central1.run.app))  
**Live Deployed Dashboard:** [https://atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app](https://atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app)  
**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Leaflet

---

## 1. Executive Summary & Purpose

The **Atlanta Heat Resilience Dashboard** translates complex spatial temperature offset predictions and Census vulnerability indicators into actionable municipal decisions for city planners, emergency management staff, and the Atlanta City Council.

As outlined in the challenge guidelines:
> *"Option Custom web UI: Full control. A map a council member could actually read beats a chat log."*  
> *"Strip the variable. Audit the outcome. Say you did both."*

This frontend connects directly to the live Cloud Run agent to deliver:
1. **Interactive Heat & Walkability Map**: Visualizes Atlanta census tract microclimate heat offsets (°F) alongside 10-minute pedestrian walking buffers around cooling center sites.
2. **Cooling Center Siting Optimization**: Ranks candidate public facilities by multi-objective composite score:
   $$\text{Composite Score} = 0.4 \times \text{Offset (°F)} + 0.3 \times \text{Poverty Rate} + 0.3 \times \text{Transit Deprivation}$$
3. **Algorithmic Climate Equity Audit**: Benchmarks recommended public investments against the City of Atlanta 75th percentile thresholds (Poverty: 24.5%, Carless Households: 14.8%) to verify that interventions counteract historical redlining and disinvestment.
4. **Historical Extreme Heat Trends (2018–2024)**: Visualizes multi-year GHCN weather station observations, demonstrating a 177% increase in days $\ge 95^\circ\text{F}$.
5. **Direct AI Advisor Chat**: Interactive natural language interface communicating directly with the deployed Cloud Run agent (`/run`), with preset action chips for all 7 Core Planner Questions and visual tool call inspection.

---

## 2. Integration with Deployed Cloud Run Agent

The dashboard communicates with the deployed ADK service through the Vite or Nginx proxy at:
`https://atlanta-heat-advisor-1004921377034.us-central1.run.app`

### Endpoints Used:
- `GET /health` – Live connection indicator and real-time latency ping.
- `POST /apps/agent/users/{userId}/sessions` – Session lifecycle management.
- `POST /run` – Multi-turn conversation and tool invocation dispatch.

### Dual Engine Capability: Live Agent API + TypeScript Mock Data
The two modes are explicit, not automatic failover:
- **Live Agent API Mode (Default):** Dispatches prompts to the Cloud Run agent and renders the completed `/run` event response. Session, HTTP and model errors surface to the user; they never become simulated recommendations.
- **Mock Data Layer Mode:** Provides a complete TypeScript simulation matching the BigQuery schemas (`heat_offset_model`, `tract_demographics`, `station_daily_temps`), allowing offline evaluation while backend SQL databases are provisioned.

### Grounded recommendation cards

The advisor renders cards only from successful (`status: OK`) ranking tool
payloads, never from numbers extracted from model prose. The Atlanta and planning
schemas are validated separately; failed, legacy status-less or malformed
rankings do not create cards. Unknown demographics are shown as unavailable,
not zero. Repeated/parallel tool responses are paired by their ADK call ID.

Cards show campaign-relative offsets, tract population and vulnerability,
model provenance when returned, and a coordinate search link to Google Maps in a new
tab (no API key required). Coordinates are also visible as selectable text so
they remain usable if an external map provider is unavailable or rate-limited.
These links do not route through the dashboard's mock tract map or claim
verified facilities/walking routes. The audit action sends the exact displayed
tract IDs back to the live agent; it does not display a mock audit or change the
ranking. Actions from messages generated in a different data mode are disabled.

Model-generated interpretation remains available under a disclosure, separate
from tool evidence. Both model families are supported for display compatibility,
but their scores and offsets are not merged. No generated HTML, dynamic code
execution, or sandbox is needed. The map, siting and equity dashboard tabs still
use their existing demonstration datasets; these cards do not make those tabs live.

Run `npm test` for event/evidence parsing and live-error regression tests, then
`npm run build` for strict TypeScript checking and production bundling.

---

## 3. Key Components & Architecture

- `src/components/HeatMap.tsx`: High-performance Leaflet mapping engine plotting 109 Atlanta census tracts with dynamic heat offset color ramps (Green $\le 0^\circ\text{F}$ to Red $\ge +4^\circ\text{F}$), 800-meter walk buffers, landmark/tract search, and real-time mobile dispatched asset markers.
- `src/components/DecisionsAndDispatch.tsx`: Synthesized Planner Action Deck featuring:
  - **Decisions Needed Triage**: Prioritized municipal actions (FY25 Council Siting Memo, Bankhead Hydration Surge, Thomasville Senior Outreach, Campbellton Cooling Bus Relay).
  - **Resource Mover (Municipal Asset Allocator)**: Real-time inventory (Potable Hydration Trailers, Mobile Wellness Vans, MARTA Climate Shelter Buses) with instant field dispatch onto the Leaflet map and live protected population counters.
- `src/components/HeatAlertBanner.tsx`: High-visibility National Weather Service Stage 3 Heat Advisory ticker and modal with emergency directives and hotspot telemetry.
- `src/components/CoolingCenterRankings.tsx`: Siting optimizer table with interactive citywide baseline forecast slider (85°F to 105°F), automatically computing localized microclimate temperatures.
- `src/components/EquityAuditDashboard.tsx`: Compliance audit module proving 100% of top recommendations land in tracts exceeding top-quartile vulnerability, with 1-click export of City Council Legislative Resolution Memoranda.
- `src/components/HistoricalTrends.tsx`: Multi-year station temperature bar chart tracking severe heat trends from 2018 to 2024.
- `src/components/AdvisorChat.tsx`: Conversational AI advisor with one-click chips for the 7 Planner Questions and tool trace inspection.
- `src/components/ExplainabilityModal.tsx`: Visual breakdown of BigQuery ML `ML.EXPLAIN_PREDICT` feature attributions (canopy loss, structural vintage, transit deprivation).

---

## 4. Local Development & Deployment

### Standalone Interactive HTML Application (Zero-Dependency)
For immediate evaluation, offline demos, and council meetings without requiring Node.js or build steps:
- Open `index.html` or `atlanta_heat_resilience_dashboard.html` in any modern web browser.
- Includes complete interactive cartography, animated dispatch routes, decisions needed triage board, active emergency heat alerts, live resource mover simulator, BigQuery historical trends, and Cloud Run ADK agent chatbot integration.

### Quick Start:
```bash
# Enter frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite local development server
npm run dev
```
The application will launch on `http://localhost:3000`.

To configure the agent URL, copy `.env.example` to `.env.local` in this directory
and fill in the base URL (without a trailing slash):

```dotenv
AGENT_API_URL=https://your-agent-service.run.app
```

`.env.local` is ignored by Git. A blank value keeps the existing deployed agent.
Restart Vite after changing this value. This variable configures the development
proxy; it does not grant access or change the agent's allowed origins.

### Building for Production:
```bash
npm run build
```
Build output is generated in `frontend/dist/`.

### Previewing Production Build:
```bash
npm run preview
```

### Local E2E validation

Run the same backend container build/test stage as Cloud Build, plus data-plane tests
and the frontend production build, from the repository root:

```bash
docker build -f agent/Dockerfile -t walkability-agent:local-e2e .
docker run --rm walkability-agent:local-e2e \
  python -m unittest discover -s /app/agent/tests -p 'test_*.py'
python3 -m unittest discover -s data_plane/tests -p 'test_*.py'
docker build -t walkability-frontend:local-e2e frontend
```

For a fully local application stack, configure ADC with access to the project containing
the models and tables. The principal needs Vertex AI prediction and BigQuery job/data
permissions; a successful `/health` response does not validate those permissions.
Start the backend in one terminal (macOS Docker Desktop example):

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
docker run --rm --name walkability-agent-local-e2e \
  -p 127.0.0.1:18080:8080 \
  --mount "type=bind,source=$HOME/.config/gcloud/application_default_credentials.json,target=/var/run/google/adc.json,readonly" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/var/run/google/adc.json \
  -e GOOGLE_GENAI_USE_VERTEXAI=TRUE \
  -e GOOGLE_CLOUD_PROJECT \
  -e GOOGLE_CLOUD_LOCATION=us-central1 \
  -e AUTO_BOOTSTRAP_BQML=false \
  walkability-agent:local-e2e \
  adk web --host 0.0.0.0 --port 8080 \
  --allow_origins http://127.0.0.1:5173 \
  --allow_origins http://localhost:5173 /app
```

In another terminal, start the production dashboard and its Nginx API proxy:

```bash
docker run --rm --name walkability-frontend-local-e2e \
  -p 127.0.0.1:5173:8080 \
  -e AGENT_API_URL=http://host.docker.internal:18080 \
  walkability-frontend:local-e2e
```

Open `http://127.0.0.1:5173`. Check the map and all tabs, change the forecast slider,
then select **AI Advisor Agent** in **Live Agent API** mode and ask a historical heat
question. Require HTTP 200 from both session creation and `/api/run`, a real
`query_heat_history` function call and function response, and the final displayed answer.
Confirm a follow-up reuses the session. Test **Mock Data** separately; it must not make
session or run requests. Stop the task-owned containers with:

```bash
docker stop walkability-frontend-local-e2e walkability-agent-local-e2e
```

To test the local production dashboard against the deployed agent instead, set
`AGENT_API_URL=https://atlanta-heat-advisor-1004921377034.us-central1.run.app` when starting
the frontend container. This is a hybrid E2E test, not a fully local backend test.
The backend must explicitly allow the frontend origin.

For Vite development against a local agent, use
`AGENT_API_URL=http://127.0.0.1:18080 npm --prefix frontend run dev` and allow
`http://localhost:3000` (or your chosen Vite origin) on the ADK server. Both `localhost`
and `127.0.0.1` use Vite's `/api/cloudrun` proxy. Container builds set
the configured `VITE_AGENT_API_URL` as the agent base URL and route `/api/cloudrun/*`
through Nginx to the `AGENT_API_URL` runtime setting.
