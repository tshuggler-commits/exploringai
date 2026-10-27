# Documentation & Submission Hub
## Atlanta Urban Climate Resilience & Walkability Advisor

Welcome to the central documentation and submission repository for the **Atlanta Urban Climate Resilience & Walkability Advisor** (Agents for Impact 2026 — Challenge 1: Urban Heat Track).

All competition submission deliverables, presentation decks, video walkthrough scripts, and technical architecture specifications are consolidated here in one place.

---

### 🏆 Official Competition Submission

* **[Official Submission Document (SUBMISSION.md)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/SUBMISSION.md)**  
  The complete, publication-ready submission writeup for the [AngelHack Submission Portal](https://portal.angelhack.com/a4i-console). Covers executive summary, target municipal persona (Dana, City Manager's Office), top 5 capabilities, placement recommendation artifact with 100% equity compliance, all recent engineering hardening (runtime isolation, telemetry spans, model contracts, Vertex AI Cloud Run deployment, Vite CORS reverse proxy), defended decisions under the 25% Rigor rubric, honest limitations, and the multi-clock roadmap.

* **[Technical Architecture & Multi-Agent Orchestration (App_Architecture.md)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/App_Architecture.md)**  
  Detailed system architecture diagrams, multi-layer decoupling (presentation, cognitive agent runtime, toolset, BQML data plane), cognitive planner mechanics, and component breakdowns.

---

### 📊 Pitch Deck & Presentation Materials

* **[Official Team Pitch Deck (ATL-6_Atlanta_Heat_Resilience_Official_Deck.pptx)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/ATL-6_Atlanta_Heat_Resilience_Official_Deck.pptx)**  
  Official widescreen PowerPoint presentation built directly on the **[ATL-6 Google Slides Hackathon Template](https://docs.google.com/presentation/d/13VJkZz-cx96Kr-NMMPFtYkJ9WUIlWUDkTUrlRBmauVw/edit)**:
  * **Slide 1:** Official Competition Instructions & Checklist.
  * **Slide 2:** Team ID (`ATL-6`) & Project Title Banner.
  * **Slide 3:** Our Team Member Roster, Filming Availability & Project Sharing.
  * **Slide 4:** Real-World Challenge, Airport Forecast Fallacy, Transit Deprivation & Municipal Persona (Dana).
  * **Slide 5:** Our Agent — Gemini 2.5 Flash, 800m Isochrone Siting Table & 100% Equity Clearance Audit.
  * **Slide 6:** Curated Data Ecosystem — NOAA Heat Watch, BQML Offset, CDC SVI & Model Explainability.
  * **Slide 7:** Technical Blueprint — Decoupled Cloud Run Architecture, Tool Specs & 3-Clock Roadmap.
  * *Embedded Speaker Notes:* Complete 3-minute timed demonstration script & judging criteria notes embedded on every slide.
  * *Direct download portal:* **[Download Deck (download_ppt.html)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/download_ppt.html)**

* **[2-Slide Executive Pitch Deck (Atlanta_Heat_Resilience_2_Slide_Deck.pptx)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/Atlanta_Heat_Resilience_2_Slide_Deck.pptx)**  
  Executive 2-slide condensed variant designed for high-density review. Also provided in legacy `.ppt` format.

* **[Interactive Web Slides & PDF Export (pitch_deck_2_slides.html)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/pitch_deck_2_slides.html)**  
  Browser-based slide deck viewer requiring zero local software. Features keyboard navigation (`←`/`→`) and a print stylesheet allowing instant 1-click export to high-resolution vector PDF.

* **[2-Slide Deck Markdown Reference (PITCH_DECK_2_SLIDES.md)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/PITCH_DECK_2_SLIDES.md)**  
  Full text and ASCII layout reference of the 2-slide presentation for quick review and version tracking.

---

### 🎥 Pitch Video & Demonstration

* **[3-Minute Timed Video Walkthrough Script (DEMO_SCRIPT.md)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/DEMO_SCRIPT.md)**  
  Choreographed second-by-second screen-share script designed to hit the 3-minute hard ceiling:
  * **[0:00 – 0:20] Section 2a:** Challenge hook & Atlanta scenario (Slide 1).
  * **[0:20 – 1:05] Section 2b.1:** Top 5 live capabilities in action (GIS map, 800m isochrones, street-name queries, composite ranking, 1-click council memo).
  * **[1:05 – 1:40] Section 2b.2:** Defended engineering decisions (bias exclusion, offset modeling, 75th-percentile hardship audit).
  * **[1:40 – 2:10] Section 2b.3:** Honest limitations & model boundaries (single-day Heat Watch baseline, station sparsity, no counterfactual simulation).
  * **[2:10 – 2:40] Section 2b.4:** Architecture tour & live Cloud Run execution (<600ms latency).
  * **[2:40 – 3:00] Section 2c:** Multi-clock strategic roadmap & outro (Slide 2).

---

### 🔬 Background Research & Context

* **[Data Sources & Analytical Framework (DATA_SOURCES.md)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/DATA_SOURCES.md)**  
  Comprehensive data dictionary, lineage, mathematical derivations (tree canopy, plantable ROW, marginal costs), multi-departmental cost-sharing matrix, MILP optimization formulation, and cohort equity drawdown analysis.

* **[Atlanta Heat Vulnerability Synopsis (atlanta_heat_vulnerability_synopsis.md)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/atlanta_heat_vulnerability_synopsis.md)**  
  Comprehensive research synopsis documenting the empirical drivers of Atlanta's urban heat island effect, historical tree canopy deficits, and demographic transportation vulnerabilities across Fulton County census tracts.

* **[Original Pitch Deck Draft (PITCH_DECK.md)](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/docs/PITCH_DECK.md)**  
  Initial working draft of the team's presentation notes and messaging concepts.

---

### 🛠️ Deployed Endpoints & Codebase References

| Resource | URL / Path | Description |
|---|---|---|
| **Live Deployed Agent API** | [https://atlanta-heat-advisor-1004921377034.us-central1.run.app](https://atlanta-heat-advisor-1004921377034.us-central1.run.app) | Production Cloud Run agent endpoint with Vertex AI mode |
| **Live Deployed Frontend Dashboard** | [https://atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app](https://atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app) | Interactive React 18 Leaflet GIS interface with temperature sliders, 800m isochrones, and memo generator |
| **Agent Core & Tools** | [../agent/](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/agent) | ADK runtime, cognitive tools, telemetry spans, and contracts |
| **Data Plane & BQML** | [../data_plane/](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/data_plane) | BigQuery datasets, feature validation, and model training pipelines |
| **GIS Frontend** | [../frontend/](https://github.com/agustincori/A4I2026-challenge-1-walkability/blob/main/frontend) | React 18 + TypeScript + Leaflet dashboard with Vite reverse proxy |
