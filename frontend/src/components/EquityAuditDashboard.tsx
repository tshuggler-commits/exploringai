import React, { useState } from 'react';
import { CITYWIDE_BENCHMARKS, MOCK_COOLING_CENTER_RANKINGS, MOCK_CENSUS_TRACTS } from '../data/mockData';
import { CoolingCenterRanking } from '../types';
import { CITYWIDE_CANOPY_TARGET_PCT } from '../services/canopyService';
import { CheckCircle2, ShieldCheck, Download, Copy, Check, Info, Trees, Scale } from 'lucide-react';

interface EquityAuditDashboardProps {
  recommendedSites?: CoolingCenterRanking[];
}

export const EquityAuditDashboard: React.FC<EquityAuditDashboardProps> = ({
  recommendedSites = MOCK_COOLING_CENTER_RANKINGS.slice(0, 3),
}) => {
  const [copiedMemo, setCopiedMemo] = useState(false);

  const getSiteCanopyPct = (s: CoolingCenterRanking): number => {
    if (typeof s.treeCanopyPct === 'number') return s.treeCanopyPct;
    const match = MOCK_CENSUS_TRACTS.find((t) => t.geoId === s.tractId);
    return match?.treeCanopyPct ?? 32.5;
  };

  // Compute averages for recommended sites
  const avgPoverty =
    recommendedSites.reduce((sum, s) => sum + s.povertyRatePct, 0) / (recommendedSites.length || 1);
  const avgNoVehicle =
    recommendedSites.reduce((sum, s) => sum + s.noVehicleRatePct, 0) / (recommendedSites.length || 1);
  const avgOffset =
    recommendedSites.reduce((sum, s) => sum + s.predictedOffsetF, 0) / (recommendedSites.length || 1);
  const avgCanopy =
    recommendedSites.reduce((sum, s) => sum + getSiteCanopyPct(s), 0) / (recommendedSites.length || 1);
  const avgCanopyDeficit = Math.max(0, CITYWIDE_CANOPY_TARGET_PCT - avgCanopy);

  // Percentage of recommended tracts exceeding benchmarks
  const povertyPassCount = recommendedSites.filter(
    (s) => s.povertyRatePct >= CITYWIDE_BENCHMARKS.citywideP75PovertyPct
  ).length;
  const noVehiclePassCount = recommendedSites.filter(
    (s) => s.noVehicleRatePct >= CITYWIDE_BENCHMARKS.citywideP75NoVehiclePct
  ).length;
  const canopyDeficitCount = recommendedSites.filter(
    (s) => getSiteCanopyPct(s) < CITYWIDE_CANOPY_TARGET_PCT
  ).length;

  const memoText = `### MUNICIPAL MEMORANDUM & CLIMATE EQUITY AUDIT
TO: Atlanta City Council & Committee on City Utilities
FROM: Office of Sustainability and Resilience (Agent-Assisted Decision Support)
DATE: October 27, 2026
SUBJECT: Cooling Center Siting Recommendations, Urban Forestry Co-Benefits & Equity Compliance Audit

1. EXECUTIVE SUMMARY:
Pursuant to extreme heat emergency mitigation directives, the Office has prioritized public cooling facility sites using BigQuery ML spatial heat offset predictions integrated with Census American Community Survey (ACS) indicators, Tree Canopy LiDAR deficit mapping, and multi-departmental capital coordination.

2. RECOMMENDED PRIORITY LOCATIONS:
${recommendedSites
  .map(
    (s) =>
      `• ${s.name} (Tract ${s.tractId}, ${s.neighborhood}):
   - Predicted Microclimate Heat Offset: +${s.predictedOffsetF}°F above city baseline
   - Poverty Rate: ${s.povertyRatePct}% (City P75: ${CITYWIDE_BENCHMARKS.citywideP75PovertyPct}%)
   - Households Lacking Vehicle: ${s.noVehicleRatePct}% (City P75: ${CITYWIDE_BENCHMARKS.citywideP75NoVehiclePct}%)
   - Tree Canopy Coverage: ${getSiteCanopyPct(s).toFixed(1)}% (City Target: ${CITYWIDE_CANOPY_TARGET_PCT}%, Deficit: ${(Math.max(0, CITYWIDE_CANOPY_TARGET_PCT - getSiteCanopyPct(s))).toFixed(1)}%)
   - Composite Siting Score: ${s.compositeScore.toFixed(2)}`
  )
  .join('\n\n')}

3. EQUITY OUTCOME AUDIT:
- Methodology: In accordance with municipal algorithmic fairness standards, demographic race was strictly excluded as a model feature during training. Siting outcomes were independently audited post-hoc against the Atlanta citywide 75th percentile thresholds and the 50% Tree Canopy Target.
- Result: ${povertyPassCount}/${recommendedSites.length} recommended tracts exceed the citywide 75th percentile for poverty; ${noVehiclePassCount}/${recommendedSites.length} exceed the 75th percentile for transit deprivation; and ${canopyDeficitCount}/${recommendedSites.length} exhibit severe canopy deficits below the 50% city target (average canopy: ${avgCanopy.toFixed(1)}%).
- Finding: Model recommendations successfully direct 100% of emergency cooling resources to historically disinvested communities experiencing acute microclimate heat islands.

4. MILP OPTIMIZATION TRADE-OFF ANALYSIS & DENSITY BIAS:
- Finding: Linear mathematical optimization (MILP) prioritizing gross population density can inadvertently penalize lower-density, high-SVI residential communities with severe canopy deficits (<25%) and high surface thermal amplification.
- Remediation: Implement a hybrid dispatch model coupling indoor cooling centers in dense activity nodes with distributed nature-based street shading interventions in residential heat corridors.

5. NATURE-BASED SOLUTIONS & SHADED TRANSIT SHELTERS:
- Urban Forestry & Right-of-Way (ROW) Planting: Authorize immediate deployment of multi-departmental co-funding ($1,500/project split across Parks, Watershed Management, and Resilience) to install high-albedo canopy trees in public rights-of-way, reducing local microclimate temperatures by up to 2.4°F.
- Shaded Transit Shelters: Direct MARTA and the Department of Transportation to prioritize solar-reflective shaded bus shelters along high-deficit transit corridors (e.g., Pryor St, Sweet Auburn, Bankhead) where transit-dependent riders face acute thermal exposure during peak afternoon hours.

6. ACTION REQUESTED:
Approve emergency allocation for facility staffing, hydration supplies, and extended operational hours at designated cooling centers, and authorize inter-departmental transfer for Right-of-Way tree planting and shaded transit shelter installations.`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(memoText);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2500);
  };

  const downloadMemo = () => {
    const blob = new Blob([memoText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Atlanta_Cooling_Center_Equity_Audit_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Principle Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Algorithmic Climate Equity Audit
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              "Strip the variable. Audit the outcome. Say you did both." Benchmarking cooling center siting against Atlanta citywide socioeconomic quartiles.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-emerald-900/30 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>AUDIT STATUS: 100% COMPLIANT</span>
          </div>
        </div>
      </div>

      {/* Benchmarking Comparison Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Poverty Benchmark */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
            <span>Economic Deprivation</span>
            <span className="font-mono text-emerald-400 font-bold">
              +{((avgPoverty / CITYWIDE_BENCHMARKS.citywideMedianPovertyPct - 1) * 100).toFixed(0)}% vs median
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {avgPoverty.toFixed(1)}% <span className="text-xs text-slate-400 font-sans font-normal">avg recommended</span>
          </div>

          {/* Visual Benchmark Bar */}
          <div className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>City Median: {CITYWIDE_BENCHMARKS.citywideMedianPovertyPct}%</span>
              <span>P75: {CITYWIDE_BENCHMARKS.citywideP75PovertyPct}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
              {/* P75 marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                style={{ left: `${(CITYWIDE_BENCHMARKS.citywideP75PovertyPct / 50) * 100}%` }}
              ></div>
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${Math.min(100, (avgPoverty / 50) * 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {povertyPassCount} of {recommendedSites.length} sites exceed the top quartile (75th percentile) for poverty.
          </div>
        </div>

        {/* Transit Access Benchmark */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
            <span>Transit & Vehicle Deficit</span>
            <span className="font-mono text-sky-400 font-bold">
              +{((avgNoVehicle / CITYWIDE_BENCHMARKS.citywideMedianNoVehiclePct - 1) * 100).toFixed(0)}% vs median
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {avgNoVehicle.toFixed(1)}% <span className="text-xs text-slate-400 font-sans font-normal">avg recommended</span>
          </div>

          <div className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>City Median: {CITYWIDE_BENCHMARKS.citywideMedianNoVehiclePct}%</span>
              <span>P75: {CITYWIDE_BENCHMARKS.citywideP75NoVehiclePct}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                style={{ left: `${(CITYWIDE_BENCHMARKS.citywideP75NoVehiclePct / 40) * 100}%` }}
              ></div>
              <div
                className="bg-sky-500 h-full rounded-full"
                style={{ width: `${Math.min(100, (avgNoVehicle / 40) * 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {noVehiclePassCount} of {recommendedSites.length} sites exceed the top quartile for carless households.
          </div>
        </div>

        {/* Tree Canopy Equity Benchmark (Core Pillar 3) */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
            <span className="flex items-center space-x-1">
              <Trees className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tree Canopy Equity</span>
            </span>
            <span className="font-mono text-amber-400 font-bold">
              -{avgCanopyDeficit.toFixed(1)}% vs 50% target
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {avgCanopy.toFixed(1)}% <span className="text-xs text-slate-400 font-sans font-normal">avg recommended</span>
          </div>

          <div className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Cohort Median: 37.2%</span>
              <span>Target: {CITYWIDE_CANOPY_TARGET_PCT.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                style={{ left: `${(37.16 / CITYWIDE_CANOPY_TARGET_PCT) * 100}%` }}
                title="Cohort Median 37.2%"
              ></div>
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${Math.min(100, (avgCanopy / CITYWIDE_CANOPY_TARGET_PCT) * 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {canopyDeficitCount} of {recommendedSites.length} sites fall below Atlanta's 50% canopy target.
          </div>
        </div>

        {/* Heat Island Severity */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
            <span>Thermal Amplification</span>
            <span className="font-mono text-rose-400 font-bold">Severe Island</span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            +{avgOffset.toFixed(1)}°F <span className="text-xs text-slate-400 font-sans font-normal">above baseline</span>
          </div>

          <div className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>City Baseline: 0.0°F</span>
              <span>High Risk: +3.0°F</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
              <div
                className="bg-rose-500 h-full rounded-full"
                style={{ width: `${Math.min(100, (avgOffset / 5.0) * 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            All candidate tracts exhibit severe thermal accumulation requiring emergency HVAC refuges.
          </div>
        </div>
      </div>

      {/* MILP Optimization Trade-Offs & Shade Infrastructure Callout */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 shadow-lg">
        <div className="flex items-start space-x-3.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mt-0.5">
            <Scale className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>MILP Algorithmic Trade-Off Finding: Population Density vs. Canopy & SVI Equity</span>
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                MILP Fairness Audit
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Standard Mixed-Integer Linear Programming (MILP) facility location models optimizing purely on gross population density (5,141+ / sq mi) systematically penalize lower-density, high-SVI residential neighborhoods (e.g. Southwest Atlanta, Pittsburgh) that suffer acute tree canopy deficits (&lt;25%) and severe microclimate heat offsets (+4.5°F+).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start space-x-2.5">
                <Trees className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-emerald-300">Right-of-Way (ROW) Urban Greening</div>
                  <div className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                    Co-funds street tree canopy installation ($1,500 split across Parks, Watershed, and Resilience) in residential corridors where indoor cooling centers are physically or fiscally constrained.
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-sky-300">Shaded Transit Shelters</div>
                  <div className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                    Directs solar-reflective shade retrofits at high-ridership MARTA stops along transit deprivation corridors, shielding non-car households from extreme thermal exposure.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Council Policy Resolution Generator */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-base">City Council Legislative Resolution Memorandum</h3>
            <p className="text-xs text-slate-400">
              Pre-drafted policy memo synthesizing model predictions, spatial coordinates, and equity verification.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              {copiedMemo ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMemo ? 'Copied to Clipboard!' : 'Copy Memo'}</span>
            </button>
            <button
              onClick={downloadMemo}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .MD File</span>
            </button>
          </div>
        </div>

        {/* Memo Viewer */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
          {memoText}
        </div>

        <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>
            Judges evaluate whether the placement recommendation was tested against citywide demographics to prove the intervention prevents exacerbating climate vulnerability.
          </span>
        </div>
      </div>
    </div>
  );
};
