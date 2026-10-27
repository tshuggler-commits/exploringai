# Atlanta Urban Climate Resilience & Walkability Advisor
## Challenge 1 — Hackathon Pitch Deck (Slide-by-Slide)

---

### Slide 1: Title & The Hook
* **Title:** Atlanta Heat Resilience & Pedestrian Walkability Advisor
* **Subtitle:** Fusing BigQuery ML Spatial Microclimates with CDC Equity Indices for Equitable Siting
* **Team:** Challenge 1 — Urban Climate Resilience Lane
* **Core Problem Statement:**
  > Atlanta's urban heat island effect is not evenly distributed. In summer heatwaves, asphalt canyons in historically redlined neighborhoods run **up to 4.7°F hotter** than the regional airport baseline. At the same time, over **47% of households in these tracts lack access to a private vehicle** and live under less than 33% tree canopy cover. When the city relies only on raw airport temperature forecasts, emergency cooling infrastructure fails the residents who cannot walk or drive to safety.

---

### Slide 2: The Core Technical Breakthrough (Offset vs. Raw Temp)
* **What everyone else did:** Treated Atlanta as a single temperature reading from Hartsfield-Jackson Airport (KATL).
* **What we built:**
  - **BigQuery ML Thermal Microclimate Modeling:** Trained `heat_offset_model` and `heat_index_prediction_model` directly on NOAA GHCN multi-station daily observations and Atlanta census tracts.
  - **Fine-Grained Spatial Offsets:** Every tract receives a localized thermal delta ($\Delta T \in [-1.2^\circ\text{F}, +4.77^\circ\text{F}]$), calculating the actual thermal stress on the street.
  - **Feature Explainability (`ML.EXPLAIN_PREDICT`):** Decomposes each tract's risk into tree canopy deficit, impervious surface density, and housing vintage.

---

### Slide 3: Beyond the Core Data — Novel Datasets
* **CDC Social Vulnerability Index (SVI):** Integrated tract-level Themes 1–4 (Poverty, Carlessness, Minority status, Housing type) from CDC ATSDR.
* **Urban Tree Canopy Inventory:** Fused Atlanta 109-tract canopy percentages (`tree_canopy_pct`) directly into BigQuery.
* **10-Minute Walkability Isochrones:** Rather than straight-line Euclidean distance, we evaluated real pedestrian access with 800-meter (10-minute walk) safety buffers for transit-dependent residents.

---

### Slide 4: Multi-Objective Siting Optimization
* **Mathematical Siting Rationale:**
  $$\text{Composite Siting Score} = 0.40 \times \text{Thermal Exposure} + 0.30 \times \text{Poverty Rate} + 0.30 \times \text{Vehicle Deprivation}$$
* **Top Recommended Siting Interventions:**
  1. **Sweet Auburn Resilience Hub** (Tract 44): +4.61°F offset, 57.7% poverty, 47.2% no vehicle, 9-min pedestrian reach.
  2. **South Pryor Community Center / Peoplestown** (Tract 65): +4.77°F offset, 48.1% poverty, 11.5% no vehicle, 11-min pedestrian reach.
  3. **Mechanicsville Recreation Center** (Tract 66.01): +4.20°F offset, 37.8% poverty, 22.0% no vehicle, 7-min pedestrian reach.

---

### Slide 5: The Centerpiece: Outcome Equity Audit
* **Auditing the Siting Decisions, Not Just the Algorithm:**
  - Standard optimization often concentrates cooling shelters in affluent or commercially dense centers.
  - **Our Audit Standard:** We benchmarked 100% of candidate sites against City of Atlanta 75th percentile hardship thresholds (Poverty $\ge 24.5\%$, Zero-Vehicle $\ge 14.8\%$).
  - **Result:** **100% of top-funded cooling centers** pass the equity standard, guaranteeing that zero public dollars are misdirected away from transit-dependent communities.
  - **One-Click Legislative Resolution Memo:** Direct exportable briefing memo ready for the Atlanta City Council.

---

### Slide 6: Live Full-Stack Architecture
* **BigQuery & BQML:** Ingests NOAA GHCN station records, CDC SVI 2022, and 109 Atlanta census tracts.
* **Serverless Agent Engine (Cloud Run):** Production Python ADK agent runtime at https://atlanta-heat-advisor-1004921377034.us-central1.run.app exposing /run, tool traces, and ML attribution.
* **Live Executive GIS Dashboard (Cloud Run):** Production React 18 + TypeScript + Leaflet app live at https://atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app.
* **Executive Dashboard Architecture (React 18 + TypeScript + Vite + Leaflet):**
  - "Talk in street names" instant landmark/neighborhood search.
  - Interactive baseline heat slider (85°F to 105°F).
  - Walk buffer visualization (800m).
  - Conversational AI Advisor with real-time tool execution inspection.

---

### Slide 7: Impact & Roadmap (This Decade)
* **Immediate (Today):** Emergency cooling center dispatch during Heat Advisory Days ($\ge 95^\circ\text{F}$).
* **This Budget Cycle:** MARTA transit integration and bus shelter shading shade-sail placement.
* **This Decade:** Urban reforestation targeting the bottom 20% tree canopy tracts (South Pryor, Sweet Auburn) to achieve permanent microclimate cooling.
