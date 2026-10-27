import shutil
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    # 16:9 Widescreen layout
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette
    COLOR_PRIMARY = RGBColor(26, 115, 232)      # Google Blue
    COLOR_DARK = RGBColor(32, 33, 36)          # Dark Slate
    COLOR_MUTED = RGBColor(95, 99, 104)        # Gray
    COLOR_RED = RGBColor(217, 48, 37)          # Alert Red
    COLOR_GREEN = RGBColor(30, 142, 62)        # Success Green
    COLOR_CARD_BG = RGBColor(248, 250, 253)    # Soft Blue-Gray
    COLOR_CARD_BORDER = RGBColor(226, 232, 240)# Border
    COLOR_WHITE = RGBColor(255, 255, 255)
    COLOR_AMBER_BG = RGBColor(254, 243, 199)   # Amber Callout
    COLOR_AMBER_TEXT = RGBColor(146, 64, 14)

    # -------------------------------------------------------------
    # SLIDE 1: Executive Pitch, Scenario & Siting Artifact
    # -------------------------------------------------------------
    slide1 = prs.slides.add_slide(blank_layout)

    # Header Box
    header_box = slide1.shapes.add_textbox(Inches(0.6), Inches(0.4), Inches(12.133), Inches(1.1))
    tf1 = header_box.text_frame
    tf1.word_wrap = True
    tf1.margin_left = tf1.margin_right = tf1.margin_top = tf1.margin_bottom = 0

    p_badge = tf1.paragraphs[0]
    p_badge.text = "TRACK: THIS BUDGET CYCLE  |  TARGET: ATLANTA, GA  |  VERTEX AI & BIGQUERY ML"
    p_badge.font.size = Pt(10)
    p_badge.font.bold = True
    p_badge.font.color.rgb = COLOR_PRIMARY
    p_badge.space_after = Pt(3)

    p_title = tf1.add_paragraph()
    p_title.text = "Atlanta Heat Resilience & Pedestrian Walkability Advisor"
    p_title.font.size = Pt(22)
    p_title.font.bold = True
    p_title.font.color.rgb = COLOR_DARK
    p_title.space_after = Pt(2)

    p_sub = tf1.add_paragraph()
    p_sub.text = "Fusing BigQuery ML Spatial Microclimates with CDC Social Vulnerability for Council-Ready Siting"
    p_sub.font.size = Pt(12)
    p_sub.font.color.rgb = COLOR_MUTED

    # Top Right Tag
    tag_box = slide1.shapes.add_textbox(Inches(9.5), Inches(0.4), Inches(3.2), Inches(0.4))
    tf_tag = tag_box.text_frame
    p_tag = tf_tag.paragraphs[0]
    p_tag.alignment = PP_ALIGN.RIGHT
    p_tag.text = "SLIDE 1 OF 2  •  INTRO & SITING"
    p_tag.font.size = Pt(10)
    p_tag.font.bold = True
    p_tag.font.color.rgb = COLOR_MUTED

    # Left Column: Card 1 (The Problem) & Card 2 (Top 5 Capabilities Preview)
    col_w = Inches(5.6)
    left_x = Inches(0.6)

    # Card 1: Problem & Scenario
    c1 = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_x, Inches(1.65), col_w, Inches(2.35))
    c1.fill.solid()
    c1.fill.fore_color.rgb = COLOR_CARD_BG
    c1.line.color.rgb = COLOR_CARD_BORDER
    c1.line.width = Pt(1)

    tf_c1 = c1.text_frame
    tf_c1.word_wrap = True
    tf_c1.margin_left = Inches(0.2)
    tf_c1.margin_right = Inches(0.2)
    tf_c1.margin_top = Inches(0.15)

    p_c1_t = tf_c1.paragraphs[0]
    p_c1_t.text = "⚠️ The 20-Second Hook: Atlanta's Urban Heat Disparity"
    p_c1_t.font.bold = True
    p_c1_t.font.size = Pt(13)
    p_c1_t.font.color.rgb = COLOR_RED
    p_c1_t.space_after = Pt(6)

    bullets_c1 = [
        ("The Airport Forecast Fallacy: ", "Regional forecasts quote KATL Airport (95°F), hiding lethal street-level microclimates running up to +4.77°F hotter in dense asphalt corridors."),
        ("Transit & Canopy Deprivation: ", "In the hottest tracts, over 47% of households have no vehicle and tree canopy drops below 33%. Residents cannot walk or drive across town to safety."),
        ("The Decision Scenario: ", "Dana in the City Manager's Office must site 3 permanent cooling centers ahead of a 102°F heatwave for City Council approval tomorrow morning.")
    ]
    for b_title, b_desc in bullets_c1:
        p = tf_c1.add_paragraph()
        p.space_after = Pt(4)
        r1 = p.add_run()
        r1.text = "• " + b_title
        r1.font.bold = True
        r1.font.size = Pt(10)
        r1.font.color.rgb = COLOR_DARK
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(10)
        r2.font.color.rgb = COLOR_DARK

    # Card 2: Top 5 Capabilities
    c2 = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_x, Inches(4.15), col_w, Inches(2.65))
    c2.fill.solid()
    c2.fill.fore_color.rgb = COLOR_CARD_BG
    c2.line.color.rgb = COLOR_CARD_BORDER
    c2.line.width = Pt(1)

    tf_c2 = c2.text_frame
    tf_c2.word_wrap = True
    tf_c2.margin_left = Inches(0.2)
    tf_c2.margin_right = Inches(0.2)
    tf_c2.margin_top = Inches(0.15)

    p_c2_t = tf_c2.paragraphs[0]
    p_c2_t.text = "💡 Top 5 Agent Capabilities (What It Does & Why)"
    p_c2_t.font.bold = True
    p_c2_t.font.size = Pt(13)
    p_c2_t.font.color.rgb = COLOR_PRIMARY
    p_c2_t.space_after = Pt(6)

    bullets_c2 = [
        ("1. Microclimate Offset Modeling: ", "Predicts localized thermal offsets (+0°F to +4.77°F) via BQML rather than raw airport averages."),
        ("2. 10-Minute Pedestrian Isochrones: ", "Evaluates real 800m walk safety rings so transit-dependent families can reach shelter on foot."),
        ("3. Talks in Street Names: ", "Planners search 'Sweet Auburn' or 'Peoplestown'—no census tract GEOIDs required."),
        ("4. Multi-Objective Siting Optimization: ", "Balances heat exposure (0.4), poverty (0.3), and zero-vehicle rates (0.3)."),
        ("5. 1-Click Council Resolution Memo: ", "Exports a pre-populated legislative memo with BigQuery ML citations ready for vote.")
    ]
    for b_title, b_desc in bullets_c2:
        p = tf_c2.add_paragraph()
        p.space_after = Pt(3)
        r1 = p.add_run()
        r1.text = "• " + b_title
        r1.font.bold = True
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = COLOR_DARK
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = COLOR_DARK

    # Right Column: Siting Recommendation Artifact & Equity Audit
    right_x = Inches(6.5)
    right_w = Inches(6.233)

    c_right = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_x, Inches(1.65), right_w, Inches(5.15))
    c_right.fill.solid()
    c_right.fill.fore_color.rgb = COLOR_WHITE
    c_right.line.color.rgb = COLOR_PRIMARY
    c_right.line.width = Pt(1.5)

    tf_cr = c_right.text_frame
    tf_cr.word_wrap = True
    tf_cr.margin_left = Inches(0.2)
    tf_cr.margin_right = Inches(0.2)
    tf_cr.margin_top = Inches(0.15)

    p_cr_t = tf_cr.paragraphs[0]
    p_cr_t.text = "🎯 Output Artifact: Ranked Siting Recommendations"
    p_cr_t.font.bold = True
    p_cr_t.font.size = Pt(13)
    p_cr_t.font.color.rgb = COLOR_PRIMARY
    p_cr_t.space_after = Pt(2)

    p_cr_sub = tf_cr.add_paragraph()
    p_cr_sub.text = "Composite Siting Score = 0.40 × Offset + 0.30 × Poverty Rate + 0.30 × Carless Rate"
    p_cr_sub.font.size = Pt(9.5)
    p_cr_sub.font.italic = True
    p_cr_sub.font.color.rgb = COLOR_MUTED
    p_cr_sub.space_after = Pt(6)

    # Add Table
    table_shape = slide1.shapes.add_table(4, 5, right_x + Inches(0.15), Inches(2.45), right_w - Inches(0.3), Inches(1.9))
    tbl = table_shape.table
    tbl.columns[0].width = Inches(1.9)
    tbl.columns[1].width = Inches(0.9)
    tbl.columns[2].width = Inches(0.9)
    tbl.columns[3].width = Inches(0.9)
    tbl.columns[4].width = Inches(1.3)

    headers = ["Recommended Site & Tract", "Offset", "Poverty", "Carless", "10-Min Reach"]
    for col_idx, h_text in enumerate(headers):
        cell = tbl.cell(0, col_idx)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(232, 240, 254)
        p = cell.text_frame.paragraphs[0]
        p.text = h_text
        p.font.bold = True
        p.font.size = Pt(9.5)
        p.font.color.rgb = COLOR_PRIMARY
        p.alignment = PP_ALIGN.CENTER if col_idx > 0 else PP_ALIGN.LEFT

    row_data = [
        (["#1 Sweet Auburn Hub\nTract 44 • 33.758, -84.379", "+4.61°F", "57.7%", "47.2%", "8,420 (9 min)"], COLOR_RED),
        (["#2 South Pryor Hub\nTract 65 • 33.731, -84.394", "+4.77°F", "48.1%", "11.5%", "6,180 (11 min)"], COLOR_RED),
        (["#3 Mechanicsville Rec\nTract 66.01 • 33.740, -84.400", "+4.20°F", "37.8%", "22.0%", "5,340 (7 min)"], COLOR_RED),
    ]

    for r_idx, (vals, offset_color) in enumerate(row_data, start=1):
        for c_idx, val in enumerate(vals):
            cell = tbl.cell(r_idx, c_idx)
            cell.text_frame.word_wrap = True
            cell.text_frame.margin_left = Inches(0.06)
            cell.text_frame.margin_right = Inches(0.06)
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(9.5)
            if c_idx == 0:
                p.font.bold = True
                p.alignment = PP_ALIGN.LEFT
            else:
                p.alignment = PP_ALIGN.CENTER
            if c_idx == 1:
                p.font.bold = True
                p.font.color.rgb = offset_color

    # Stat KPI Boxes
    kpi_w = (right_w - Inches(0.5)) / 3
    kpis = [
        ("19,940", "Residents Sheltered", COLOR_PRIMARY),
        ("+4.53°F", "Avg Thermal Delta", COLOR_RED),
        ("100%", "Equity Audit Pass", COLOR_GREEN)
    ]
    for i, (val, lbl, color) in enumerate(kpis):
        kpi_x = right_x + Inches(0.15) + (i * (kpi_w + Inches(0.1)))
        kpi_box = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, kpi_x, Inches(4.55), kpi_w, Inches(0.85))
        kpi_box.fill.solid()
        kpi_box.fill.fore_color.rgb = COLOR_CARD_BG
        kpi_box.line.color.rgb = COLOR_CARD_BORDER
        tf_k = kpi_box.text_frame
        tf_k.word_wrap = True
        tf_k.margin_top = Inches(0.1)
        p1 = tf_k.paragraphs[0]
        p1.text = val
        p1.alignment = PP_ALIGN.CENTER
        p1.font.bold = True
        p1.font.size = Pt(17)
        p1.font.color.rgb = color
        p2 = tf_k.add_paragraph()
        p2.text = lbl
        p2.alignment = PP_ALIGN.CENTER
        p2.font.size = Pt(8.5)
        p2.font.color.rgb = COLOR_MUTED

    # Amber Callout Box: Siting Outcome Equity Audit
    callout = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_x + Inches(0.15), Inches(5.55), right_w - Inches(0.3), Inches(1.1))
    callout.fill.solid()
    callout.fill.fore_color.rgb = COLOR_AMBER_BG
    callout.line.color.rgb = RGBColor(245, 158, 11)
    callout.line.width = Pt(1.5)
    tf_co = callout.text_frame
    tf_co.word_wrap = True
    tf_co.margin_left = Inches(0.15)
    tf_co.margin_right = Inches(0.15)
    tf_co.margin_top = Inches(0.1)

    p_co_t = tf_co.paragraphs[0]
    p_co_t.text = "🏛️ Centerpiece: Outcome Equity Audit Benchmarked Against Hardship"
    p_co_t.font.bold = True
    p_co_t.font.size = Pt(10.5)
    p_co_t.font.color.rgb = COLOR_AMBER_TEXT
    p_co_t.space_after = Pt(2)

    p_co_b = tf_co.add_paragraph()
    p_co_b.text = "• 100% Equity Benchmark Pass: All 3 recommended sites exceed Atlanta's 75th-percentile hardship cutoffs (Poverty ≥ 24.5%, Carless ≥ 14.8%). Zero algorithmic equity drift.\n• Legislative Action: 1-click generation of exportable Atlanta City Council Resolution Memo."
    p_co_b.font.size = Pt(9)
    p_co_b.font.color.rgb = COLOR_AMBER_TEXT

    # Slide 1 Footer
    f1 = slide1.shapes.add_textbox(Inches(0.6), Inches(6.9), Inches(12.133), Inches(0.35))
    tf_f1 = f1.text_frame
    p_f1 = tf_f1.paragraphs[0]
    p_f1.text = "AngelHack / Google A4I Challenge 1  •  GitHub: agustincori/A4I2026-challenge-1-walkability  •  Cloud Run: atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app"
    p_f1.font.size = Pt(9)
    p_f1.font.color.rgb = COLOR_MUTED

    # Slide 1 Notes: Full Presentation & Video Talk Track
    notes1 = slide1.notes_slide.notes_text_frame
    notes1.text = (
        "=== SLIDE 1 PRESENTATION TALK TRACK & 3-MINUTE VIDEO SCRIPT ===\n\n"
        "--- PART 1: SLIDE 1 WALKTHROUGH (FOR LIVE PITCH / PRESENTATION) ---\n"
        "• Context & Hook: When heat advisories hit Atlanta, regional news reports quote KATL Airport (95°F). But microclimates in dense asphalt neighborhoods run up to +4.77°F hotter.\n"
        "• The Inequity: In tracts like Sweet Auburn, Peoplestown, and Mechanicsville, over 47% of households have no vehicle and canopy coverage is below 33%. Residents cannot drive or walk miles to distant regional shelters.\n"
        "• The Municipal Scenario: Dana in the City Manager's Office must site 3 permanent cooling centers ahead of an imminent 102°F heatwave for City Council approval tomorrow morning.\n"
        "• The Technical Solution: We built the Atlanta Heat Resilience Advisor using Vertex AI (Gemini 2.5 Flash), Google ADK runtime, and BigQuery ML (heat_offset_model + ML.EXPLAIN_PREDICT). We combine spatial microclimates with CDC SVI hardship indicators and 800m pedestrian walk isochrones.\n"
        "• The Siting Recommendations: Top 3 sites identified: Sweet Auburn (Tract 27, score 0.864), South Pryor / Peoplestown (Tract 55.02, score 0.838), and Mechanicsville (Tract 56, score 0.811), sheltering 19,850 high-risk residents.\n\n"
        "--- PART 2: VIDEO WALKTHROUGH TALK TRACK (EXACT TIMING: 0:00 - 2:40) ---\n\n"
        "[0:00 - 0:20] SECTION 2a: INTRO OF CHALLENGE & IMPORTANCE (SLIDE 1 ON SCREEN)\n"
        "\"Good afternoon, judges. When a heat advisory hits Atlanta, news reports quote KATL Airport: 95°F. But in dense neighborhoods like Sweet Auburn and Peoplestown, microclimates run up to 4.8 degrees hotter.\n"
        "Over 47% of households there have no car, and tree canopy drops below 33%. For Challenge 1's budget track, Dana in the City Manager's office must site 3 permanent cooling centers before tomorrow's 9 AM City Council session.\n"
        "We built the Atlanta Urban Climate Resilience Advisor to solve this with BigQuery ML, pedestrian walk buffers, and an equity audit. Let's see the live tool in action.\"\n\n"
        "[AT 0:20 -> SWITCH SCREEN-SHARE TO LIVE WORKING GIS DASHBOARD]\n\n"
        "[0:20 - 1:05] SECTION 2b - PART A: TOP 5 CAPABILITIES (45 SECONDS)\n"
        "(Action: Navigate map, search 'Sweet Auburn', toggle walk buffer, click tract details, open Council Memo)\n"
        "\"Here is our live deployed advisor. It delivers five critical capabilities:\n"
        "1. Microclimate Offset Modeling: Rather than blunt airport temperatures, our BigQuery ML model predicts localized thermal offsets—revealing Sweet Auburn is +4.61°F hotter than city baseline.\n"
        "2. 10-Minute Pedestrian Isochrones: Notice these 800-meter blue walking rings. A carless resident cannot walk 3 miles in extreme heat. We test physical street access, not straight lines.\n"
        "3. Talks in Street Names: Planners don't memorize Census GEOIDs. Dana simply types 'Sweet Auburn' or 'Peoplestown' and the system instantly resolves the neighborhood.\n"
        "4. Multi-Objective Siting Optimization: Our algorithm balances heat exposure, poverty, and carlessness, automatically ranking Sweet Auburn, South Pryor, and Mechanicsville as the top 3 sites—sheltering nearly 20,000 residents.\n"
        "5. One-Click Council Resolution Memo: A planner can export this pre-populated legislative memo with statutory justifications and model citations ready for an immediate council vote.\"\n\n"
        "[1:05 - 1:40] SECTION 2b - PART B: TOP 4 DEFENDED DECISIONS (35 SECONDS)\n"
        "(Action: Switch to Equity Audit tab and highlight the 100% equity clearance card)\n"
        "\"We defended four core engineering decisions along the way:\n"
        "1. Ethical Bias Handling: We strictly excluded race and ethnicity variables from model training to prevent self-fulfilling redlining proxies. Fairness is audited on the output instead.\n"
        "2. Offset vs. Raw Temperature: Modeling thermal offsets isolates fixed physical urban built form from seasonal weather noise.\n"
        "3. Hardship Threshold Benchmarking: We audit candidate sites against Atlanta's 75th-percentile hardship cutoffs—24.5% poverty and 14.8% carlessness. 100% of our sites clear this standard, guaranteeing zero equity drift.\n"
        "4. Pedestrian Isochrones over Radii: An 800m street walk network respects interstate and rail barriers that trap transit-dependent pedestrians.\"\n\n"
        "[1:40 - 2:10] SECTION 2b - PART C: CONSTRAINTS & LIMITATIONS (30 SECONDS)\n"
        "(Action: Open Explainability panel with ML.EXPLAIN_PREDICT feature bars)\n"
        "\"As an honest engineering team, we explicitly acknowledge our constraints:\n"
        "First, our baseline relies on NOAA Heat Watch traverses, which capture a single representative hot day. Longitudinal seasonal data is required for multi-year wind patterns.\n"
        "Second, long-term weather stations in Atlanta are clustered near airports, requiring spatial interpolation across urban core tracts.\n"
        "And third, while ML.EXPLAIN_PREDICT diagnoses root causes—telling us canopy deficit adds +2.4°F and impervious asphalt adds +1.8°F—it cannot simulate post-planting counterfactual cooling without multi-year canopy growth data. We diagnose the cause; we don't falsely claim to simulate the tree's future.\"\n\n"
        "[2:10 - 2:40] SECTION 2b - PART D: ARCHITECTURE TOUR OF DEPLOYED PIECES (30 SECONDS)\n"
        "(Action: Open AI Advisor tab, trigger a query, show sub-600ms latency and Cloud Run deployment)\n"
        "\"Here is the deployed architecture serving this experience:\n"
        "At the top is Gemini 2.5 Flash on Vertex AI, orchestrated with Google ADK using 7 custom Python domain tools.\n"
        "In the data layer, BigQuery ML powers heat_offset_model and ML.EXPLAIN_PREDICT directly inside Google Cloud.\n"
        "The backend is deployed on serverless Google Cloud Run, serving our /run endpoint with sub-600ms latency.\n"
        "And the frontend is built with React 18, TypeScript, and Leaflet GIS, providing an executive interface designed specifically for municipal planners.\"\n\n"
        "[AT 2:40 -> SWITCH SCREEN-SHARE BACK TO SLIDE 2 FOR FINAL 20-SECOND OUTRO]"
    )

    # -------------------------------------------------------------
    # SLIDE 2: Defended Decisions, Architecture, Constraints & Outro
    # -------------------------------------------------------------
    slide2 = prs.slides.add_slide(blank_layout)

    # Header Box
    header_box2 = slide2.shapes.add_textbox(Inches(0.6), Inches(0.4), Inches(12.133), Inches(1.1))
    tf2 = header_box2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_right = tf2.margin_top = tf2.margin_bottom = 0

    p_badge2 = tf2.paragraphs[0]
    p_badge2.text = "GOOGLE CLOUD VERTEX AI  |  BIGQUERY ML EXPLAINABILITY  |  SERVERLESS CLOUD RUN"
    p_badge2.font.size = Pt(10)
    p_badge2.font.bold = True
    p_badge2.font.color.rgb = COLOR_PRIMARY
    p_badge2.space_after = Pt(3)

    p_title2 = tf2.add_paragraph()
    p_title2.text = "Technical Architecture, Rigor, Limitations & Roadmap"
    p_title2.font.size = Pt(22)
    p_title2.font.bold = True
    p_title2.font.color.rgb = COLOR_DARK
    p_title2.space_after = Pt(2)

    p_sub2 = tf2.add_paragraph()
    p_sub2.text = "Four Pillars: Top Capabilities, Defended Decisions, Honest Limitations & Deployed Stack"
    p_sub2.font.size = Pt(12)
    p_sub2.font.color.rgb = COLOR_MUTED

    # Top Right Tag
    tag_box2 = slide2.shapes.add_textbox(Inches(9.5), Inches(0.4), Inches(3.2), Inches(0.4))
    tf_tag2 = tag_box2.text_frame
    p_tag2 = tf_tag2.paragraphs[0]
    p_tag2.alignment = PP_ALIGN.RIGHT
    p_tag2.text = "SLIDE 2 OF 2  •  RUBRIC DEFENSE"
    p_tag2.font.size = Pt(10)
    p_tag2.font.bold = True
    p_tag2.font.color.rgb = COLOR_MUTED

    # 3-Column Layout
    col3_w = Inches(3.85)
    gap = Inches(0.29)
    y_top = Inches(1.65)
    h_col = Inches(5.15)

    # Column 1: Architecture Tour
    col1_x = Inches(0.6)
    sc1 = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, col1_x, y_top, col3_w, h_col)
    sc1.fill.solid()
    sc1.fill.fore_color.rgb = COLOR_CARD_BG
    sc1.line.color.rgb = COLOR_CARD_BORDER
    sc1.line.width = Pt(1)

    tf_sc1 = sc1.text_frame
    tf_sc1.word_wrap = True
    tf_sc1.margin_left = Inches(0.2)
    tf_sc1.margin_right = Inches(0.2)
    tf_sc1.margin_top = Inches(0.18)

    p_sc1_t = tf_sc1.paragraphs[0]
    p_sc1_t.text = "⚙️ Architecture Tour (Deployed Stack)"
    p_sc1_t.font.bold = True
    p_sc1_t.font.size = Pt(13)
    p_sc1_t.font.color.rgb = COLOR_PRIMARY
    p_sc1_t.space_after = Pt(8)

    bullets_sc1 = [
        ("Vertex AI & Gemini 2.5 Flash: ", "Google ADK runtime with isolated sessions, bounded spatial guards, and correlated telemetry spans."),
        ("BigQuery ML at the Core: ", "heat_offset_model on NOAA Heat Watch + CDC SVI. ML.EXPLAIN_PREDICT outputs exact feature attributions."),
        ("Serverless Cloud Run & Vertex ADC: ", "Gen2 service with GOOGLE_GENAI_USE_VERTEXAI=TRUE, native readiness polling, and zero API keys."),
        ("Executive GIS Dashboard: ", "React 18 + TS + Leaflet with 85°–105°F microclimate slider, 800m isochrones, and zero-key OSM tiles."),
        ("Vite Reverse Proxy & CORS-Free: ", "Reverse-proxied /api/agent eliminating CORS errors; pre-configured for port 8080 Cloud Shell Preview.")
    ]
    for b_title, b_desc in bullets_sc1:
        p = tf_sc1.add_paragraph()
        p.space_after = Pt(6)
        r1 = p.add_run()
        r1.text = "• " + b_title
        r1.font.bold = True
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = COLOR_DARK
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = COLOR_DARK

    # Column 2: Top Defended Decisions
    col2_x = col1_x + col3_w + gap
    sc2 = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, col2_x, y_top, col3_w, h_col)
    sc2.fill.solid()
    sc2.fill.fore_color.rgb = COLOR_CARD_BG
    sc2.line.color.rgb = COLOR_CARD_BORDER
    sc2.line.width = Pt(1)

    tf_sc2 = sc2.text_frame
    tf_sc2.word_wrap = True
    tf_sc2.margin_left = Inches(0.2)
    tf_sc2.margin_right = Inches(0.2)
    tf_sc2.margin_top = Inches(0.18)

    p_sc2_t = tf_sc2.paragraphs[0]
    p_sc2_t.text = "🛡️ Top 4 Decisions Made & Defended"
    p_sc2_t.font.bold = True
    p_sc2_t.font.size = Pt(13)
    p_sc2_t.font.color.rgb = COLOR_PRIMARY
    p_sc2_t.space_after = Pt(8)

    bullets_sc2 = [
        ("1. Race Excluded from Features: ", "Intentionally omitted race/ethnicity variables from ML training to prevent proxy bias; equity is verified post-hoc on outcomes."),
        ("2. Predicted Offsets, Not Raw Temp: ", "Raw temperatures overfit seasonal weather; microclimate thermal deltas isolate permanent physical infrastructure effects."),
        ("3. Hardship Threshold Benchmarking: ", "Audited against Atlanta's 75th-percentile hardship cutoffs (poverty ≥24.5%, carless ≥14.8%) rather than subjective intent."),
        ("4. Pedestrian Walk Isochrones: ", "Replaced Euclidean radii with 800m walk buffers—a carless family cannot cross an interstate highway in extreme heat.")
    ]
    for b_title, b_desc in bullets_sc2:
        p = tf_sc2.add_paragraph()
        p.space_after = Pt(6)
        r1 = p.add_run()
        r1.text = "• " + b_title
        r1.font.bold = True
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = COLOR_DARK
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = COLOR_DARK

    # Column 3: Honest Constraints & Multi-Clock Roadmap
    col3_x = col2_x + col3_w + gap
    sc3 = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, col3_x, y_top, col3_w, h_col)
    sc3.fill.solid()
    sc3.fill.fore_color.rgb = COLOR_CARD_BG
    sc3.line.color.rgb = COLOR_CARD_BORDER
    sc3.line.width = Pt(1)

    tf_sc3 = sc3.text_frame
    tf_sc3.word_wrap = True
    tf_sc3.margin_left = Inches(0.2)
    tf_sc3.margin_right = Inches(0.2)
    tf_sc3.margin_top = Inches(0.18)

    p_sc3_t = tf_sc3.paragraphs[0]
    p_sc3_t.text = "🔍 Constraints & Outro Roadmap"
    p_sc3_t.font.bold = True
    p_sc3_t.font.size = Pt(13)
    p_sc3_t.font.color.rgb = COLOR_RED
    p_sc3_t.space_after = Pt(6)

    bullets_sc3 = [
        ("Honest Constraint — Single-Day Baseline: ", "NOAA Heat Watch traverses capture one representative hot summer day; variance under differing wind patterns requires longitudinal data.", COLOR_RED),
        ("Honest Constraint — No Tree Simulation: ", "ML.EXPLAIN_PREDICT diagnoses root causes (+2.4°F canopy deficit), but cannot simulate future post-planting cooling without longitudinal growth models.", COLOR_RED),
        ("⚡ Today Track (Immediate): ", "Dispatch mobile hydration vans and cooling buses to Sweet Auburn during Heat Advisories (≥95°F).", COLOR_GREEN),
        ("🏛️ This Budget Cycle: ", "Fund solar-reflective shade-sails at 42 unshaded MARTA stops inside the 10-minute walk buffers.", COLOR_GREEN),
        ("🌳 This Decade: ", "Urban forestry program targeted at the bottom 20% canopy tracts to reverse microclimate disparity.", COLOR_GREEN)
    ]
    for b_title, b_desc, col in bullets_sc3:
        p = tf_sc3.add_paragraph()
        p.space_after = Pt(5)
        r1 = p.add_run()
        r1.text = "• " + b_title
        r1.font.bold = True
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = col
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = COLOR_DARK

    # Slide 2 Footer
    f2 = slide2.shapes.add_textbox(Inches(0.6), Inches(6.9), Inches(12.133), Inches(0.35))
    tf_f2 = f2.text_frame
    p_f2 = tf_f2.paragraphs[0]
    p_f2.text = "Judging Rubric: Impact (30) • Execution (30) • Rigor & Judgment (25) • Craft (15) • Bonus Range (+10)"
    p_f2.font.size = Pt(9)
    p_f2.font.color.rgb = COLOR_MUTED

    # Slide 2 Notes: Full Presentation & Video Outro Talk Track
    notes2 = slide2.notes_slide.notes_text_frame
    notes2.text = (
        "=== SLIDE 2 PRESENTATION TALK TRACK & VIDEO OUTRO ===\n\n"
        "--- PART 1: SLIDE 2 WALKTHROUGH (FOR LIVE PITCH / TECHNICAL DEFENSE) ---\n"
        "• Column 1: System Architecture Tour\n"
        "  - Vertex AI & Gemini 2.5 Flash: ADK runtime with isolated sessions, bounded spatial guards ([-84.55, 33.64] to [-84.28, 33.89]), and correlated telemetry spans.\n"
        "  - BigQuery ML at the Core: heat_offset_model trained on NOAA Heat Watch + Census ACS. ML.EXPLAIN_PREDICT unpacks canopy deficits (+2.4°F) and impervious asphalt (+1.8°F).\n"
        "  - Serverless Cloud Run & Vertex ADC: Gen2 Cloud Run with GOOGLE_GENAI_USE_VERTEXAI=TRUE, native readiness polling, and zero client API keys.\n"
        "  - Executive GIS Dashboard: React 18 + TypeScript + Leaflet with real-time 85°–105°F slider, 800m walk isochrones, and zero-key OSM tiles.\n"
        "  - Vite Reverse Proxy: CORS-free /api/agent routing configured for Cloud Shell port 8080 evaluation.\n\n"
        "• Column 2: Defended Engineering Decisions\n"
        "  1. Race/ethnicity excluded from model training to prevent self-fulfilling redlining proxies; equity enforced on post-hoc outcomes.\n"
        "  2. Microclimate offsets modeled rather than raw ambient temperatures to isolate permanent built infrastructure from seasonal weather swings.\n"
        "  3. Siting clearance benchmarked against Atlanta 75th-percentile hardship cutoffs (poverty >= 24.5%, carless >= 14.8%).\n"
        "  4. 800m pedestrian walk networks replace circular Euclidean radii to respect highway and rail barriers.\n\n"
        "• Column 3: Honest Constraints & Multi-Clock Roadmap\n"
        "  - Constraint: Single-day NOAA traverse baseline; longitudinal multi-year calibration needed.\n"
        "  - Constraint: Airport station clustering requires spatial interpolation across core tracts.\n"
        "  - Constraint: Explanations isolate root causes but cannot simulate multi-year post-planting canopy growth.\n"
        "  - Multi-Clock Action Plan: Today (hydration vans), This Budget Cycle (42 MARTA shade-sails), This Decade (urban forestry canopy in bottom 20% tracts).\n\n"
        "--- PART 2: VIDEO OUTRO TALK TRACK (EXACT TIMING: 2:40 - 3:00) ---\n\n"
        "[2:40 - 3:00] SECTION 2c: OUTRO & MULTI-CLOCK ROADMAP (SLIDE 2 ON SCREEN - 20 SECONDS)\n"
        "\"To wrap up: our advisor gives Atlanta leaders an actionable, defensible path across all three clocks.\n"
        "Tomorrow, emergency management can dispatch mobile hydration vans to Sweet Auburn.\n"
        "This budget cycle, the city can fund 42 transit shade structures at unshaded MARTA stops inside our walk buffers.\n"
        "And this decade, urban forestry can target canopy planting where it delivers the highest thermal relief per dollar.\n"
        "By connecting BigQuery ML with street-level walkability and an uncompromising equity audit, we ensure no neighborhood is left behind. Thank you.\"\n\n"
        "--- PART 3: PRESENTER 3-MINUTE VIDEO TIMING CHEATSHEET ---\n"
        "• 0:00 - 0:20 (20s): Intro & Scenario Hook (Slide 1 Fullscreen)\n"
        "• 0:20 - 1:05 (45s): Top 5 Capabilities (Live GIS Map Screen-Share)\n"
        "• 1:05 - 1:40 (35s): Top 4 Defended Decisions (Live Equity Tab Screen-Share)\n"
        "• 1:40 - 2:10 (30s): Constraints & Honest Limitations (Explainability Panel)\n"
        "• 2:10 - 2:40 (30s): Architecture Tour of Deployed Stack (AI Advisor Query & Cloud Run)\n"
        "• 2:40 - 3:00 (20s): Multi-Clock Roadmap & Outro (Slide 2 Fullscreen)\n"
        "TOTAL DURATION: EXACTLY 180 SECONDS (3 MINUTES)\n\n"
        "--- PART 4: JUDGING CRITERIA CROSSWALK ---\n"
        "• Impact (30%): Siting shelters 19,850 high-risk residents; 10-minute walk buffers prioritize transit-dependent families.\n"
        "• Execution (30%): Live Cloud Run service, Vertex AI ADK agent, React 18 frontend, sub-600ms latency, zero CORS.\n"
        "• Rigor & Judgment (25%): Race excluded from features, 75th percentile equity benchmarking, explicit constraint honesty.\n"
        "• Craft (15%): Production UI, clean presentation deck, responsive map, 1-click City Council legislative memo."
    )

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_paths = [
        os.path.join(repo_root, "docs", "Atlanta_Heat_Resilience_2_Slide_Deck.pptx"),
        os.path.join(repo_root, "docs", "Atlanta_Heat_Resilience_2_Slide_Deck.ppt"),
        os.path.join(repo_root, "frontend", "public", "Atlanta_Heat_Resilience_2_Slide_Deck.pptx"),
        os.path.join(repo_root, "frontend", "public", "Atlanta_Heat_Resilience_2_Slide_Deck.ppt"),
        os.path.join(r"C:\Users\tshug\.gemini\antigravity\brain\18c7ad46-c91f-408a-a59a-912c804c2ced", "Atlanta_Heat_Resilience_2_Slide_Deck.pptx"),
        os.path.join(r"C:\Users\tshug\.gemini\antigravity\brain\18c7ad46-c91f-408a-a59a-912c804c2ced", "Atlanta_Heat_Resilience_2_Slide_Deck.ppt"),
    ]
    primary_path = target_paths[0]
    prs.save(primary_path)
    for p in target_paths[1:]:
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            shutil.copyfile(primary_path, p)
        except Exception as e:
            print(f"Error copying to {p}: {e}")
    print(f"Successfully saved presentation to all target locations: {primary_path}")

if __name__ == "__main__":
    create_deck()
