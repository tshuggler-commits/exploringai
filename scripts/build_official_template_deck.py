import os
import shutil
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

def build_official_deck():
    template_path = r"C:\Users\tshug\AppData\Local\Programs\antigravity\downloaded_template.pptx"
    prs = pptx.Presentation(template_path)

    COLOR_WHITE = RGBColor(255, 255, 255)
    COLOR_MUTED = RGBColor(180, 180, 180)

    # -------------------------------------------------------------
    # SLIDE 1: Instructions (Keep template as is)
    # -------------------------------------------------------------

    # -------------------------------------------------------------
    # SLIDE 2: Title & Project Name
    # -------------------------------------------------------------
    s2 = prs.slides[1]
    tf2 = s2.shapes[0].text_frame
    tf2.text = "Cooling Hotlanta"
    for p in tf2.paragraphs:
        p.font.size = Pt(28)
        p.font.bold = True
        p.font.color.rgb = COLOR_WHITE
        p.alignment = PP_ALIGN.LEFT

    # -------------------------------------------------------------
    # SLIDE 3: Our Team
    # -------------------------------------------------------------
    s3 = prs.slides[2]
    tbl = s3.shapes[0].table
    members = [
        ("Tanya Huggler", "tanya.huggler@coxautoinc.com", "518-542-5335", "1:00", "", ""),
        ("Agustin Corigliano", "pagustincorigliano@gmail.com", "786-721-3109", "1:00", "", ""),
        ("Joel Metuge", "joelmetuge0707@gmail.com", "256-797-2970", "1:00", "", ""),
        ("David Ballagh", "david.ballagh@gmail.com", "352-978-8537", "1:00", "", ""),
        ("Vamshi Gangula", "vkgangula@gmail.com", "503-726-8746", "1:00", "", "")
    ]
    for r_idx, member in enumerate(members, start=1):
        for c_idx, val in enumerate(member):
            cell = tbl.cell(r_idx, c_idx)
            cell.text = val
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(9.5)
                p.font.color.rgb = COLOR_WHITE

    # -------------------------------------------------------------
    # SLIDE 4: Challenge Overview
    # -------------------------------------------------------------
    s4 = prs.slides[3]
    tf4 = s4.shapes[3].text_frame
    tf4.clear()

    p = tf4.paragraphs[0]
    p.text = "Real-world challenge"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = COLOR_WHITE
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(4)

    p = tf4.add_paragraph()
    p.text = "Severe urban heat islands threatening public health across vulnerable, tree-deprived Atlanta neighborhoods."
    p.font.size = Pt(13)
    p.font.color.rgb = COLOR_WHITE
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(24)

    p = tf4.add_paragraph()
    p.text = "Details"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = COLOR_WHITE
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(4)

    p = tf4.add_paragraph()
    p.text = "Vulnerable residents benefit; mitigates heat deaths, lowers energy costs, and advances climate equity."
    p.font.size = Pt(13)
    p.font.color.rgb = COLOR_WHITE
    p.alignment = PP_ALIGN.CENTER

    # -------------------------------------------------------------
    # SLIDE 5: Impact
    # -------------------------------------------------------------
    s5 = prs.slides[4]
    tf5 = s5.shapes[1].text_frame
    tf5.clear()

    p = tf5.paragraphs[0]
    p.text = "Our Agent"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = COLOR_WHITE
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(4)

    p = tf5.add_paragraph()
    p.text = "Predicts hyper-local heat spikes to deploy targeted cooling interventions and life-saving community alerts."
    p.font.size = Pt(13)
    p.font.color.rgb = COLOR_WHITE
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(24)

    p = tf5.add_paragraph()
    p.text = "Details"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = COLOR_WHITE
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(4)

    p = tf5.add_paragraph()
    p.text = "Planners query interactive heat maps to prioritize shade infrastructure, optimizing municipal budgets and resilience."
    p.font.size = Pt(13)
    p.font.color.rgb = COLOR_WHITE
    p.alignment = PP_ALIGN.CENTER

    # -------------------------------------------------------------
    # SLIDE 6: Sources
    # -------------------------------------------------------------
    s6 = prs.slides[5]
    tf6 = s6.shapes[0].text_frame
    tf6.clear()

    p = tf6.paragraphs[0]
    p.text = "Our data ecosystem is orchestrated on Google Cloud, fusing petabyte-scale geospatial telemetry, municipal infrastructure layers, and public health indicators inside BigQuery."
    p.font.size = Pt(9.5)
    p.font.color.rgb = COLOR_WHITE
    p.space_after = Pt(8)

    p = tf6.add_paragraph()
    p.text = "By coupling Google Earth Engine\u2019s automated satellite pipeline with BigQuery Spatial SQL, the agent performs real-time multi-criteria analysis across environmental, structural, and demographic variables."
    p.font.size = Pt(9.5)
    p.font.color.rgb = COLOR_WHITE
    p.space_after = Pt(8)

    p = tf6.add_paragraph()
    p.text = "This continuous data backbone breaks down municipal silos, transforming raw static archives into a live predictive intelligence engine tailored for municipal decision-makers."
    p.font.size = Pt(9.5)
    p.font.color.rgb = COLOR_WHITE
    p.space_after = Pt(12)

    p = tf6.add_paragraph()
    p.text = "Details"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_WHITE
    p.space_after = Pt(4)

    p = tf6.add_paragraph()
    p.text = "We ingest high-resolution Landsat-9 and Sentinel-2 thermal imagery alongside live NOAA weather stations to map surface temperature anomalies down to the parcel level."
    p.font.size = Pt(9.5)
    p.font.color.rgb = COLOR_WHITE
    p.space_after = Pt(8)

    p = tf6.add_paragraph()
    p.text = "These thermal models are joined with City of Atlanta Open GIS layers\u2014specifically LiDAR tree canopy assessments, impervious surface footprints, and municipal zoning boundaries\u2014to diagnose built-environment heat traps."
    p.font.size = Pt(9.5)
    p.font.color.rgb = COLOR_WHITE
    p.space_after = Pt(8)

    p = tf6.add_paragraph()
    p.text = "Crucially, the agent cross-references CDC Social Vulnerability Index (SVI) BigQuery tables, U.S. Census ACS economic data, and NREL energy burden metrics to ensure cooling investments are prioritized in historically underserved neighborhoods."
    p.font.size = Pt(9.5)
    p.font.color.rgb = COLOR_WHITE
    p.space_after = Pt(12)

    p = tf6.add_paragraph()
    p.text = "*Architecture included in GitHub"
    p.font.size = Pt(9.5)
    p.font.italic = True
    p.font.color.rgb = COLOR_MUTED

    # -------------------------------------------------------------
    # SLIDE 7: Prototype Architecture
    # -------------------------------------------------------------
    s7 = prs.slides[6]
    tf7 = s7.shapes[0].text_frame
    tf7.clear()

    p = tf7.paragraphs[0]
    p.text = "Details: Multi-Agent Mechanics & Communication"
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = COLOR_WHITE
    p.space_after = Pt(10)

    points = [
        (
            "1. Supervisor Orchestration (ADK Framework):",
            "The Lead Orchestrator Agent acts as the central state manager built using the Agent Development Kit (ADK). When a planner inputs a goal (e.g., \"Allocate $2M to reduce heat vulnerability in District 4\"), the Orchestrator decomposes the request into parallel, task-specific sub-queries and manages context across sub-agents."
        ),
        (
            "2. Standardized Tool Integration (Model Context Protocol / MCP):",
            "Each sub-agent connects to underlying data lakes using standardized MCP servers via JSON-RPC:\n"
            "  \u25cb Thermal Agent: Calls the Earth Engine MCP tool to retrieve real-time Landsat-9 Land Surface Temperatures (LST) and NOAA meteorological data.\n"
            "  \u25cb Urban Spatial Agent: Calls the BigQuery Spatial MCP tool to evaluate Atlanta parcel footprints, LiDAR tree canopy, and impervious asphalt ratios.\n"
            "  \u25cb Social Vulnerability Agent: Interfaces with BigQuery to extract CDC SVI metrics and Census demographic profiles."
        ),
        (
            "3. Synthesis & Feedback Loop:",
            "Once data agents return their vector analyses, the Scenario Optimizer Agent ingests the combined context to simulate high-impact interventions (e.g., cool roofs, reflective pavement, shade trees) constrained by municipal budgets. The Orchestrator validates the solution against city policy constraints and exports an actionable GeoJSON map layer and prioritized investment report directly back to the planner."
        )
    ]

    for title, body in points:
        p = tf7.add_paragraph()
        p.text = title
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = COLOR_WHITE
        p.space_after = Pt(3)

        p_b = tf7.add_paragraph()
        p_b.text = body
        p_b.font.size = Pt(9)
        p_b.font.color.rgb = COLOR_WHITE
        p_b.space_after = Pt(8)

    # Save outputs
    repo_root = r"C:\Users\tshug\.gemini\antigravity\scratch\A4I2026-challenge-1-walkability"
    target_pptx_files = [
        os.path.join(repo_root, "docs", "ATL-6_Atlanta_Heat_Resilience_Official_Deck.pptx"),
        os.path.join(repo_root, "docs", "Cooling_Hotlanta_Pitch_Deck.pptx"),
        os.path.join(repo_root, "docs", "Atlanta_Heat_Resilience_2_Slide_Deck.pptx"),
        os.path.join(repo_root, "docs", "Atlanta_Heat_Resilience_2_Slide_Deck.ppt"),
        os.path.join(repo_root, "frontend", "public", "ATL-6_Atlanta_Heat_Resilience_Official_Deck.pptx"),
        os.path.join(repo_root, "frontend", "public", "Cooling_Hotlanta_Pitch_Deck.pptx"),
        os.path.join(repo_root, "frontend", "public", "Atlanta_Heat_Resilience_2_Slide_Deck.pptx"),
        os.path.join(repo_root, "frontend", "public", "Atlanta_Heat_Resilience_2_Slide_Deck.ppt"),
    ]

    primary_out = target_pptx_files[0]
    prs.save(primary_out)
    print(f"Generated primary PPTX: {primary_out} ({os.path.getsize(primary_out)} bytes)")

    for target in target_pptx_files[1:]:
        shutil.copyfile(primary_out, target)
        print(f"Copied to: {target}")

    # Copy PDF from Downloads to docs and frontend
    pdf_source = r"C:\Users\tshug\Downloads\ATL-6.pdf"
    if os.path.exists(pdf_source):
        target_pdfs = [
            os.path.join(repo_root, "docs", "ATL-6.pdf"),
            os.path.join(repo_root, "docs", "Cooling_Hotlanta_Pitch_Deck.pdf"),
            os.path.join(repo_root, "frontend", "public", "ATL-6.pdf"),
            os.path.join(repo_root, "frontend", "public", "Cooling_Hotlanta_Pitch_Deck.pdf"),
        ]
        for t_pdf in target_pdfs:
            shutil.copyfile(pdf_source, t_pdf)
            print(f"Copied PDF to: {t_pdf}")

if __name__ == "__main__":
    build_official_deck()
