import base64
import os

pptx_path = r"C:\Users\tshug\.gemini\antigravity\scratch\A4I2026-challenge-1-walkability\docs\ATL-6_Atlanta_Heat_Resilience_Official_Deck.pptx"
artifact_dir = r"C:\Users\tshug\.gemini\antigravity\brain\18c7ad46-c91f-408a-a59a-912c804c2ced"
repo_root = r"C:\Users\tshug\.gemini\antigravity\scratch\A4I2026-challenge-1-walkability"

with open(pptx_path, "rb") as f:
    b64_content = base64.b64encode(f.read()).decode("utf-8")

file_size_kb = round(os.path.getsize(pptx_path) / 1024, 1)

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download ATL-6 Official Pitch Deck</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
</head>
<body class="bg-slate-900 text-slate-100 antialiased p-4 font-sans">
  <div class="bg-slate-800 text-slate-100 border border-slate-700 rounded-2xl p-6 shadow-xl max-w-xl mx-auto">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl font-bold shadow-sm">
          📊
        </div>
        <div>
          <h2 class="text-base font-bold text-white leading-tight">ATL-6 Official Pitch Deck</h2>
          <p class="text-xs text-slate-400">Google Slides Official Template (7 Slides with Full Speaker Notes)</p>
        </div>
      </div>
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        Ready • {file_size_kb} KB
      </span>
    </div>

    <!-- Slide Overview Summary -->
    <div class="grid grid-cols-2 gap-2.5 mb-4">
      <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/80 text-xs space-y-1">
        <div class="font-semibold text-slate-200 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-blue-400 inline-block"></span> Slides 1–3: Team & Setup
        </div>
        <p class="text-slate-400">Official instructions, ATL-6 banner, team roster & filming availability.</p>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/80 text-xs space-y-1">
        <div class="font-semibold text-slate-200 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Slide 4: Real-World Challenge
        </div>
        <p class="text-slate-400">Airport forecast fallacy, transit deprivation & Dana's municipal scenario.</p>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/80 text-xs space-y-1">
        <div class="font-semibold text-slate-200 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> Slide 5: Agent Capabilities
        </div>
        <p class="text-slate-400">Gemini 2.5 Flash, 800m isochrones, top 3 siting & 100% equity clearance.</p>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/80 text-xs space-y-1">
        <div class="font-semibold text-slate-200 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-purple-400 inline-block"></span> Slides 6–7: Data & Blueprint
        </div>
        <p class="text-slate-400">NOAA Heat Watch, BQML offset, CDC SVI, Cloud Run multi-agent architecture.</p>
      </div>
    </div>

    <!-- Notes badge -->
    <div class="p-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300 mb-4 flex items-center gap-2">
      <span>🎙️</span>
      <span><strong>Speaker Notes Included:</strong> Timed 3-minute video talk track and judging criteria notes are embedded on every slide.</span>
    </div>

    <!-- Download Actions -->
    <div class="flex flex-wrap items-center gap-2.5">
      <button id="dlBtnOfficial" onclick="downloadFile('ATL-6_Atlanta_Heat_Resilience_Official_Deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')"
        class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs bg-blue-600 hover:bg-blue-500 text-white active:scale-95 transition-all shadow cursor-pointer">
        <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Download ATL-6 Deck (.pptx)
      </button>

      <button id="dlBtnLegacy" onclick="downloadFile('Atlanta_Heat_Resilience_2_Slide_Deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')"
        class="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 active:scale-95 transition-all cursor-pointer">
        <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        Download (.ppt)
      </button>
    </div>

    <!-- Notification Toast -->
    <div id="statusMsg" class="mt-3 text-xs text-center font-medium text-emerald-400 opacity-0 transition-opacity duration-300">
      ✓ Download started in your browser
    </div>
  </div>

  <script>
    const b64Data = "{b64_content}";

    function downloadFile(filename, mimeType) {{
      try {{
        const byteCharacters = atob(b64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {{
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }}
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {{ type: mimeType }});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const status = document.getElementById('statusMsg');
        status.textContent = '✓ ' + filename + ' downloaded successfully!';
        status.style.opacity = '1';
        setTimeout(() => {{
          status.style.opacity = '0';
        }}, 4000);
      }} catch (err) {{
        console.error(err);
        alert('Download failed: ' + err.message);
      }}
    }}
  </script>
</body>
</html>
"""

target_paths = [
    os.path.join(artifact_dir, "presentation_download_widget.html"),
    os.path.join(artifact_dir, "download_ppt.html"),
    os.path.join(repo_root, "docs", "download_ppt.html"),
    os.path.join(repo_root, "frontend", "public", "download_ppt.html"),
]

for p in target_paths:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Wrote: {p}")
