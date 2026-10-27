import { ToolCallTrace } from '../types';
import { parseAgentEvents } from './agentEvidence';

export const CLOUD_RUN_URL = (
  import.meta.env?.VITE_AGENT_API_URL || 'https://atlanta-heat-advisor-1004921377034.us-central1.run.app'
).replace(/\/+$/, '');

// Detect whether to use relative proxy in dev or direct Cloud Run URL
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // If hosted directly on Cloud Run, use root relative path
    if (window.location.origin === CLOUD_RUN_URL) {
      return '';
    }
    // Route through Vite proxy to avoid CORS origins restrictions
    return '/api/cloudrun';
  }
  return CLOUD_RUN_URL;
};

class AgentApiService {
  private baseUrl: string = getBaseUrl();
  private directUrl: string = CLOUD_RUN_URL;
  private userId: string = 'atlanta-planner-' + Math.random().toString(36).substring(2, 8);
  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private lastLatencyMs: number = 0;

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public setEndpoint(url: string) {
    this.baseUrl = url;
    this.directUrl = url;
    this.sessionId = null;
  }

  public getEndpoint(): string {
    return this.directUrl;
  }

  public getLastLatency(): number {
    return this.lastLatencyMs;
  }

  public async checkHealth(): Promise<{ status: string; latencyMs: number; ok: boolean }> {
    const start = performance.now();
    try {
      // Try local proxy first (if on dev server), or direct URL
      const targetUrl = this.baseUrl.startsWith('/') ? this.baseUrl + '/health' : `${this.directUrl}/health`;
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const end = performance.now();
      this.lastLatencyMs = Math.round(end - start);

      if (res.ok) {
        const data = await res.json();
        this.isConnected = true;
        return { status: data.status || 'ok', latencyMs: this.lastLatencyMs, ok: true };
      }
      return { status: `HTTP ${res.status}`, latencyMs: this.lastLatencyMs, ok: false };
    } catch {
      // Fallback direct probe
      try {
        const res2 = await fetch(`${this.directUrl}/health`, { method: 'GET' });
        const end2 = performance.now();
        this.lastLatencyMs = Math.round(end2 - start);
        if (res2.ok) {
          this.isConnected = true;
          return { status: 'ok', latencyMs: this.lastLatencyMs, ok: true };
        }
      } catch (err2: any) {
        this.isConnected = false;
        return { status: err2.message || 'Offline', latencyMs: 0, ok: false };
      }
      this.isConnected = false;
      return { status: 'Unreachable', latencyMs: 0, ok: false };
    }
  }

  public async getOrCreateSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;

    const url = this.baseUrl.startsWith('/')
      ? `${this.baseUrl}/apps/agent/users/${this.userId}/sessions`
      : `${this.directUrl}/apps/agent/users/${this.userId}/sessions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!res.ok) throw new Error(`Could not create agent session (HTTP ${res.status}).`);
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || !('id' in data)
      || typeof data.id !== 'string' || !data.id) {
      throw new Error('The agent returned an invalid session.');
    }
    this.sessionId = data.id;
    return data.id;
  }

  public async runAgent(
    messageText: string,
    options?: { useMockFallback?: boolean }
  ): Promise<{ responseText: string; toolCalls: ToolCallTrace[]; model?: string; latencyMs: number; source: 'live' | 'mock' }> {
    const start = performance.now();

    if (!options?.useMockFallback) {
      const sessionId = await this.getOrCreateSession();
      const url = this.baseUrl.startsWith('/') ? `${this.baseUrl}/run` : `${this.directUrl}/run`;

      const payload = {
        appName: 'agent',
        userId: this.userId,
        sessionId: sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: messageText }],
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const end = performance.now();
      const latencyMs = Math.round(end - start);

      if (!res.ok) {
        if (res.status === 404) this.sessionId = null;
        throw new Error(`Agent request failed (HTTP ${res.status}). No simulated results were substituted.`);
      }
      return { ...parseAgentEvents(await res.json()), latencyMs, source: 'live' };
    }

    // High fidelity domain-specific fallback for offline demo or simulated mock mode
    const fallback = this.generateDomainFallbackResponse(messageText);
    const end = performance.now();
    return {
      responseText: fallback.text,
      toolCalls: fallback.toolCalls,
      model: 'gemini-2.5-flash (local / mock cached)',
      latencyMs: Math.round(end - start),
      source: 'mock',
    };
  }

  private generateDomainFallbackResponse(prompt: string): { text: string; toolCalls: ToolCallTrace[] } {
    const lower = prompt.toLowerCase();

    if (lower.includes('where') && (lower.includes('cooling') || lower.includes('center') || lower.includes('fund'))) {
      return {
        text: `### Cooling Center Siting Recommendations for the City of Atlanta

Based on the BigQuery ML heat offset model fused with socioeconomic census metrics, here are the top 3 recommended priority sites for public cooling centers:

1. **Rank 1: South Pryor Community Center** (Census Tract \`13121006802\`, Peoplestown)
   - **Predicted Microclimate Offset:** **+4.2°F** above Atlanta city baseline
   - **Poverty Rate:** **38.4%** | **Carless Households:** **28.5%**
   - **Composite Vulnerability Score:** **3.69**
   - *Driver:* Heavy asphalt density and older housing stock with missing canopy.

2. **Rank 2: English Avenue Resilience Hub** (Census Tract \`13121007808\`, Bankhead / Vine City)
   - **Predicted Microclimate Offset:** **+3.8°F**
   - **Poverty Rate:** **42.1%** | **Carless Households:** **34.0%**
   - **Composite Vulnerability Score:** **3.80**
   - *Driver:* Extreme economic isolation and lack of personal vehicular transport.

3. **Rank 3: Thomasville Community Recreation Facility** (Census Tract \`13121002200\`, South Atlanta)
   - **Predicted Microclimate Offset:** **+4.6°F**
   - **Poverty Rate:** **44.5%** | **Carless Households:** **36.2%**
   - **Composite Vulnerability Score:** **4.26**
   - *Driver:* Severe urban heat island hotspot with limited canopy and older residential structures.

All three sites pass our climate equity audit (falling well above the citywide 75th percentile for poverty and transit deficit).`,
        toolCalls: [
          {
            name: 'rank_cooling_center_sites',
            arguments: { top_n: 3, focus_criteria: 'vulnerability_and_heat' },
            output: { count: 3, status: 'success' },
          },
        ],
      };
    }

    if (lower.includes('why') && (lower.includes('pryor') || lower.includes('piedmont') || lower.includes('hotter') || lower.includes('disparit'))) {
      return {
        text: `### Microclimate Disparity Analysis: South Pryor St vs. Piedmont Park

**Spatial Temperature Differential:** **+6.3°F** differential!
- **South Pryor St (Tract 13121006802):** Predicted Heat Offset **+4.2°F** (localized temp **106.2°F** on a 102°F forecast).
- **Piedmont Park (Tract 13121005800):** Predicted Heat Offset **-2.1°F** (localized temp **99.9°F** on a 102°F forecast).

### Top Explaining Feature Attributions (\`ML.EXPLAIN_PREDICT\`):
1. **Tree Canopy & Impervious Surface Deficit (+1.85°F):** South Pryor has only 14.2% tree canopy vs 54.0% in Piedmont Park. Dense asphalt absorbs and re-radiates daytime thermal radiation.
2. **Structural Vintage & Thermal Mass (+1.25°F):** Average housing vintage along Pryor St is 1958 with low insulation and masonry roofs, whereas Midtown/Piedmont features newer construction (2005+) and modern HVAC cooling.
3. **Poverty & Transit Deprivation (+0.85°F):** Reflects historical infrastructure underinvestment, with higher roadway-to-greenery ratios and reduced shade infrastructure.`,
        toolCalls: [
          {
            name: 'compare_locations_and_explain',
            arguments: {
              lat1: 33.7298,
              lon1: -84.3942,
              label1: 'South Pryor St',
              lat2: 33.7850,
              lon2: -84.3735,
              label2: 'Piedmont Park',
            },
            output: { delta_f: 6.3 },
          },
        ],
      };
    }

    if (lower.includes('history') || lower.includes('trend') || lower.includes('95') || lower.includes('worse') || lower.includes('often')) {
      return {
        text: `### Historical Extreme Heat Frequency Analysis (GHCN Weather Stations 2018–2024)

Analysis of Atlanta daily observations demonstrates an escalating frequency of extreme temperature thresholds:
- **2018:** 9 days $\\ge 95^\\circ\\text{F}$ | Summer Peak: 97.2°F
- **2019:** 23 days $\\ge 95^\\circ\\text{F}$ | Summer Peak: 99.1°F
- **2021:** 6 days $\\ge 95^\\circ\\text{F}$ | Summer Peak: 95.3°F
- **2022:** 18 days $\\ge 95^\\circ\\text{F}$ | Summer Peak: 98.4°F
- **2023:** 21 days $\\ge 95^\\circ\\text{F}$ (1 day over 100°F) | Summer Peak: 100.2°F
- **2024:** **25 days $\\ge 95^\\circ\\text{F}$** (2 days over 100°F) | Summer Peak: **101.4°F**

**Trend Finding:** The frequency of dangerous $\\ge 95^\\circ\\text{F}$ heat events has nearly tripled since 2018, underscoring that microclimate heat offsets in vulnerable neighborhoods now present acute public health emergencies during peak summer months.`,
        toolCalls: [
          {
            name: 'query_heat_history',
            arguments: { min_temp_f: 95.0, start_year: 2018 },
            output: { station: 'Atlanta Hartsfield-Jackson Airport', records_count: 7 },
          },
        ],
      };
    }

    if (lower.includes('audit') || lower.includes('equity')) {
      return {
        text: `### Climate Equity Audit of Proposed Siting Plan

**Benchmarking against City of Atlanta Top Quartile (75th Percentile):**
- **Citywide 75th Percentile Poverty Threshold:** 24.5%
- **Citywide 75th Percentile No-Vehicle Threshold:** 14.8%

**Audited Recommendations:**
- **Tract 13121006802 (South Pryor St):** Poverty 38.4% (PASS) | No Vehicle 28.5% (PASS)
- **Tract 13121007808 (English Ave):** Poverty 42.1% (PASS) | No Vehicle 34.0% (PASS)
- **Tract 13121002200 (Thomasville Hts):** Poverty 44.5% (PASS) | No Vehicle 36.2% (PASS)

**Audit Outcome: PASSED (100% Alignment)**
The proposed cooling center interventions land squarely in tracts suffering both highest physical heat exposure and acute mobility isolation. The placement rigorously counteracts historic disinvestment.`,
        toolCalls: [
          {
            name: 'audit_equity',
            arguments: { selected_tract_ids: ['13121006802', '13121007808', '13121002200'] },
            output: { poverty_pass: true, vehicle_pass: true },
          },
        ],
      };
    }

    if (
      lower.includes('canopy') ||
      lower.includes('greening') ||
      lower.includes('tree') ||
      lower.includes('forestry') ||
      lower.includes('parks & resilience') ||
      lower.includes('ordinance') ||
      lower.includes('50%')
    ) {
      return {
        text: `### Urban Tree Canopy & Nature-Based Resilience Siting

**Strategic Benchmark Alignment:**
- **City of Atlanta Decade Track Target:** **50.0%** canopy coverage
- **Urban Cohort Median Canopy:** **37.16%**
- **Critical Canopy Deficit Threshold:** **< 20.0%** (Severe heat exposure & shade deprivation)

**Top Prioritized Canopy Interventions:**
1. **Tract 13121006802 (South Pryor / Peoplestown)**
   - **Current Canopy:** **14.2%** (Deficit: **-35.8%** vs 50% target)
   - **Thermal Offset:** **+4.2°F** | **SVI:** **0.86**
   - **Recommended Action:** 65 right-of-way street trees + cool pavement transit retrofits.
   - **Co-Funding Matrix:** Fully qualifies for Parks & Recreation (<37.16%) + Watershed (>5,141.4 pop/sq mi) + Resilience (SVI > 0.50).

2. **Tract 13121007808 (English Avenue / Bankhead)**
   - **Current Canopy:** **18.7%** (Deficit: **-31.3%** vs 50% target)
   - **Thermal Offset:** **+3.8°F** | **SVI:** **0.92**
   - **Recommended Action:** 55 right-of-way street trees + shaded MARTA stop canopies.
   - **Co-Funding Matrix:** Qualifies for Parks + Watershed + Resilience co-budgeting ($500 split each).

3. **Tract 13121002200 (Thomasville Heights / South Atlanta)**
   - **Current Canopy:** **16.5%** (Deficit: **-33.5%** vs 50% target)
   - **Thermal Offset:** **+4.6°F** | **SVI:** **0.94**
   - **Recommended Action:** 60 right-of-way street trees + residential canopy distribution.
   - **Co-Funding Matrix:** Qualifies for Parks + Watershed + Resilience co-funding.

**Multi-Departmental Funding Framework ($120,000 Cap):**
- **Office of Parks & Recreation ($40,000 cap):** $38,500 allocated (96.3%)
- **Department of Watershed Management ($50,000 cap):** $39,250 allocated (78.5%)
- **Office of Resilience ($30,000 cap):** $28,750 allocated (95.8%)
- **Standard Project Grant:** $1,500 per tract intervention, divided equally among eligible departments.`,
        toolCalls: [
          {
            name: 'recommend_canopy_interventions',
            arguments: { top_n: 3, min_pop_density: 1000.0 },
            output: {
              city_target_canopy_pct: 50.0,
              strategic_framework: 'Atlanta Decade Track Urban Forestry & Heat Equity Plan',
              count: 3,
            },
          },
        ],
      };
    }

    // Default assistant response
    return {
      text: `As Senior Climate Resilience Advisor for the City of Atlanta, I can assist you with:
- **Predicting heat offsets** for any Atlanta coordinate or Census tract
- **Ranking candidate cooling centers** based on thermal and social vulnerability
- **Explaining microclimate disparities** using BigQuery ML feature attributions
- **Auditing public investments** for climate equity against citywide thresholds
- **Optimizing urban canopy & street tree investments** under the Atlanta 50% canopy target and multi-departmental co-funding model
- **Analyzing multi-year GHCN weather trends** from 2018 to present.

What decision or scenario would you like to evaluate today?`,
      toolCalls: [],
    };
  }
}

export const agentApi = new AgentApiService();
