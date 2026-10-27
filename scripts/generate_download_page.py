import base64
import os
import shutil

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pptx_path = os.path.join(repo_root, "docs", "Atlanta_Heat_Resilience_2_Slide_Deck.pptx")
with open(pptx_path, "rb") as f:
    pptx_b64 = base64.b64encode(f.read()).decode("utf-8")

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Presentation — Atlanta Urban Climate Resilience Advisor</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f0f4f8;
      color: #202124;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }}
    .download-card {{
      background: #ffffff;
      max-width: 680px;
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.1);
      padding: 40px;
      text-align: center;
      border: 1px solid #dadce0;
    }}
    .icon {{
      font-size: 54px;
      margin-bottom: 12px;
    }}
    h1 {{
      font-size: 24px;
      color: #1a73e8;
      margin-bottom: 8px;
    }}
    p {{
      color: #5f6368;
      font-size: 15px;
      line-height: 1.5;
      margin-bottom: 24px;
    }}
    .btn-group {{
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }}
    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #1a73e8;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      padding: 14px 24px;
      border-radius: 8px;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: background 0.2s, transform 0.1s;
      box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
    }}
    .btn:hover {{
      background: #1557b0;
      transform: translateY(-1px);
    }}
    .btn.btn-secondary {{
      background: #34a853;
      box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3);
    }}
    .btn.btn-secondary:hover {{
      background: #2d9249;
    }}
    .meta-box {{
      margin-top: 24px;
      background: #f8fafd;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      text-align: left;
      font-size: 13px;
    }}
    .meta-box ul {{
      margin: 8px 0 0 20px;
      color: #3c4043;
    }}
    .meta-box li {{
      margin-bottom: 6px;
    }}
    .alt-link {{
      margin-top: 18px;
      font-size: 13px;
      color: #5f6368;
    }}
    .alt-link a {{
      color: #1a73e8;
      text-decoration: underline;
    }}
  </style>
</head>
<body>

  <div class="download-card">
    <div class="icon">📊</div>
    <h1>Download Pitch Deck Presentation</h1>
    <p>
      <strong>Atlanta Heat Resilience & Pedestrian Walkability Advisor</strong><br>
      2-Slide Executive PowerPoint Deck with Embedded Presenter Talk Track & Rubric Defense.
    </p>

    <!-- Download Triggers -->
    <div class="btn-group">
      <button class="btn" onclick="triggerDownload('Atlanta_Heat_Resilience_2_Slide_Deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')">
        <span>📥</span> Download .PPTX File
      </button>
      <button class="btn btn-secondary" onclick="triggerDownload('Atlanta_Heat_Resilience_2_Slide_Deck.ppt', 'application/vnd.ms-powerpoint')">
        <span>📥</span> Download .PPT File
      </button>
    </div>

    <div class="meta-box">
      <strong>Included Inside:</strong>
      <ul>
        <li><strong>Slide 1:</strong> Executive Pitch, Siting Artifact (Sweet Auburn, South Pryor, Mechanicsville), 800m Walk Isochrones, & Outcome Equity Audit.</li>
        <li><strong>Slide 2:</strong> Vertex AI / Gemini 2.5 Flash / BQML Architecture, Explicit Bias Handling (No Race Features), & Honest Limitations.</li>
        <li><strong>Presenter Notes:</strong> Word-for-word 90-second voiceover talk track embedded in PowerPoint's Notes pane.</li>
      </ul>
    </div>

    <div class="alt-link">
      <span>Prefer in-browser view? </span>
      <a href="pitch_deck_2_slides.html">Open Web Slides / PDF Export View</a>
    </div>
  </div>

  <script>
    const b64Data = "{pptx_b64}";

    function triggerDownload(fileName, mimeType) {{
      const byteCharacters = atob(b64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {{
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }}
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {{ type: mimeType }});
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }}

    // Auto-trigger download if '?auto=true' is in URL
    if (window.location.search.includes("auto=true")) {{
      window.addEventListener("DOMContentLoaded", () => {{
        setTimeout(() => triggerDownload('Atlanta_Heat_Resilience_2_Slide_Deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), 300);
      }});
    }}
  </script>
</body>
</html>
"""

out_html = os.path.join(repo_root, "docs", "download_ppt.html")
with open(out_html, "w", encoding="utf-8") as f:
    f.write(html_content)

out_pub_html = os.path.join(repo_root, "frontend", "public", "download_ppt.html")
with open(out_pub_html, "w", encoding="utf-8") as f:
    f.write(html_content)

out_artifact_html = os.path.join(r"C:\Users\tshug\.gemini\antigravity\brain\18c7ad46-c91f-408a-a59a-912c804c2ced", "download_ppt.html")
try:
    with open(out_artifact_html, "w", encoding="utf-8") as f:
        f.write(html_content)
except Exception as e:
    print(f"Error saving to artifact: {e}")

print(f"Generated standalone download pages across docs, frontend, and artifacts")
