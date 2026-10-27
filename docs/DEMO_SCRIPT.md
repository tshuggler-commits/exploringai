# Atlanta Urban Climate Resilience Advisor — 3-Minute Video Walkthrough Script
## Exactly Timed for Google / AngelHack Submission (Challenge 1)

> **Total Video Target Time:** **3 minutes (180 seconds)**  
> **Structure:**  
> - **2a.** 20s Intro (Challenge & Importance — Slide 1 on screen)  
> - **2b.** 2m 20s Live Demo of Solution in Action (Screen-share)  
>   - *a. Top 5 Capabilities (45s)*  
>   - *b. Top 4 Decisions Made & Defended (35s)*  
>   - *c. Constraints & What It Can't Do (30s)*  
>   - *d. Architecture Tour of Deployed Pieces (30s)*  
> - **2c.** 20s Outro (Roadmap across clocks & Closing Hook — Slide 2 on screen)  

---

### [0:00 – 0:20] Section 2a: Intro of Challenge & Importance (20 Seconds)
**Screen:** Show **Slide 1** of `Atlanta_Heat_Resilience_2_Slide_Deck.pptx` in full screen.

> **Speaker (Voiceover):**  
> *"Good afternoon, judges. When a heat advisory hits Atlanta, news reports quote KATL Airport: 95°F. But in dense neighborhoods like Sweet Auburn and Peoplestown, microclimates run up to 4.8 degrees hotter.  
> Over 47% of households there have no car, and tree canopy drops below 33%. For Challenge 1's budget track, Dana in the City Manager's office must site 3 permanent cooling centers before tomorrow's 9 AM City Council session.  
> We built the Atlanta Urban Climate Resilience Advisor to solve this with BigQuery ML, pedestrian walk buffers, and an equity audit. Let's see the live tool in action."*

*(At 0:20, switch screen-share to the live working GIS Dashboard)*

---

### [0:20 – 2:40] Section 2b: Live Demo of Solution in Action (2 Minutes 20 Seconds)

#### Part A: Top 5 Capabilities & Why They Matter [0:20 – 1:05] (45s)
**Action on screen:** Navigate map, search "Sweet Auburn", toggle walk buffer, click tract details, open Council Memo.

> **Speaker:**  
> *"Here is our live deployed advisor. It delivers five critical capabilities:  
> 1. **Microclimate Offset Modeling:** Rather than blunt airport temperatures, our BigQuery ML model predicts localized thermal offsets—revealing Sweet Auburn is +4.61°F hotter than city baseline.  
> 2. **10-Minute Pedestrian Isochrones:** Notice these 800-meter blue walking rings. A carless resident cannot walk 3 miles in extreme heat. We test physical street access, not straight lines.  
> 3. **Talks in Street Names:** Planners don't memorize Census GEOIDs. Dana simply types 'Sweet Auburn' or 'Peoplestown' and the system instantly resolves the neighborhood.  
> 4. **Multi-Objective Siting Optimization:** Our algorithm balances heat exposure, poverty, and carlessness, automatically ranking Sweet Auburn, South Pryor, and Mechanicsville as the top 3 sites—sheltering nearly 20,000 residents.  
> 5. **One-Click Council Resolution Memo:** A planner can export this pre-populated legislative memo with statutory justifications and model citations ready for an immediate council vote."*

#### Part B: Top 4 Decisions Made & Defended [1:05 – 1:40] (35s)
**Action on screen:** Show the Siting Optimization / Equity Audit tab and feature attribution card.

> **Speaker:**  
> *"We defended four core engineering decisions along the way:  
> 1. **Ethical Bias Handling:** We strictly excluded race and ethnicity variables from model training to prevent self-fulfilling redlining proxies. Fairness is audited on the output instead.  
> 2. **Offset vs. Raw Temperature:** Modeling thermal offsets isolates fixed physical urban built form from seasonal weather noise.  
> 3. **Hardship Threshold Benchmarking:** We audit candidate sites against Atlanta's 75th-percentile hardship cutoffs—24.5% poverty and 14.8% carlessness. 100% of our sites clear this standard, guaranteeing zero equity drift.  
> 4. **Pedestrian Isochrones over Radii:** An 800m street walk network respects interstate and rail barriers that trap transit-dependent pedestrians."*

#### Part C: Constraints & What the Model Can't Do [1:40 – 2:10] (30s)
**Action on screen:** Point to the Explainability panel (`ML.EXPLAIN_PREDICT` feature attribution bars).

> **Speaker:**  
> *"As an honest engineering team, we explicitly acknowledge our constraints:  
> First, our baseline relies on NOAA Heat Watch traverses, which capture a single representative hot day. Variances under different wind patterns require longitudinal data.  
> Second, long-term weather stations in Atlanta are clustered near airports, requiring spatial interpolation across urban core tracts.  
> And third, while `ML.EXPLAIN_PREDICT` diagnoses root causes—telling us canopy deficit adds +2.4°F and impervious asphalt adds +1.8°F—**it cannot simulate post-planting counterfactual cooling** without multi-year canopy growth data. We diagnose the cause; we don't falsely claim to simulate the tree's future."*

#### Part D: Architecture Tour of Deployed Pieces [2:10 – 2:40] (30s)
**Action on screen:** Open the AI Advisor tab, trigger a query, show tool execution latency (<600ms) and Cloud Run deployment.

> **Speaker:**  
> *"Here is the deployed architecture serving this experience:  
> At the top is **Gemini 2.5 Flash on Vertex AI**, orchestrated with the **Google Agent Development Kit (ADK)** using 7 custom Python domain tools.  
> In the data layer, **BigQuery ML** powers `heat_offset_model` and `ML.EXPLAIN_PREDICT` directly inside Google Cloud.  
> The backend is deployed on **serverless Google Cloud Run**, serving our `/run` endpoint with sub-600ms latency.  
> And the frontend is built with **React 18, TypeScript, and Leaflet GIS**, providing an executive interface designed specifically for municipal planners."*

*(At 2:40, switch back to Slide 2 of the presentation)*

---

### [2:40 – 3:00] Section 2c: Outro & Multi-Clock Roadmap (20 Seconds)
**Screen:** Show **Slide 2** of `Atlanta_Heat_Resilience_2_Slide_Deck.pptx` in full screen.

> **Speaker:**  
> *"To close: our advisor equips Atlanta across three distinct clocks.  
> Tomorrow, emergency management can dispatch mobile hydration vans to Sweet Auburn.  
> This budget cycle, the city can fund 42 transit shade structures at unshaded MARTA stops inside our walk buffers.  
> And this decade, urban forestry can target canopy planting where it delivers the highest thermal relief per dollar.  
> By pairing BigQuery ML with street-level pedestrian walkability and an uncompromising equity audit, Atlanta can protect every neighborhood this summer. Thank you."*

---

### Presenter Timing Cheatsheet (Total: 3:00)
- `0:00 - 0:20` (20s): Intro & Scenario Hook *(Slide 1)*
- `0:20 - 1:05` (45s): Top 5 Capabilities *(Live Map Demo)*
- `1:05 - 1:40` (35s): Top 4 Defended Decisions *(Live Equity Audit Demo)*
- `1:40 - 2:10` (30s): Constraints & Honest Limitations *(Explainability Panel)*
- `2:10 - 2:40` (30s): Architecture Tour of Deployed Stack *(Live Agent Query)*
- `2:40 - 3:00` (20s): Multi-Clock Roadmap & Outro *(Slide 2)*
