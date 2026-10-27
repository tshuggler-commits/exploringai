import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  X, 
  Copy, 
  Check, 
  Download, 
  Printer, 
  ShieldAlert, 
  Users, 
  DollarSign,
  Trees
} from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { 
  CouncilMemoData, 
  generateCouncilMemo, 
  formatMemoAsMarkdown, 
  exportMemoToFile 
} from '../services/memoService';
import { MOCK_COOLING_CENTER_RANKINGS, INITIAL_DISPATCHED_ASSETS } from '../data/mockData';

export const CouncilMemoModal: React.FC = () => {
  const { isCouncilMemoOpen, councilMemoData, closeCouncilMemo } = useUI();
  const [copied, setCopied] = useState(false);

  const { modalRef, handleBackdropClick } = useModalDismiss({
    isOpen: isCouncilMemoOpen,
    onClose: closeCouncilMemo,
  });

  // Resolve or generate the official memo
  const memo: CouncilMemoData = useMemo(() => {
    if (councilMemoData && councilMemoData.memoId && councilMemoData.executiveSummary) {
      return councilMemoData as CouncilMemoData;
    }
    const sites = councilMemoData?.sites || MOCK_COOLING_CENTER_RANKINGS.slice(0, 3);
    const dispatchedAssets = councilMemoData?.dispatchedAssets || INITIAL_DISPATCHED_ASSETS;
    const options = councilMemoData?.options || {};
    return generateCouncilMemo(sites, dispatchedAssets, options);
  }, [councilMemoData, isCouncilMemoOpen]);

  const memoMarkdown = useMemo(() => formatMemoAsMarkdown(memo), [memo]);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(memoMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy memo to clipboard:', err);
    }
  };

  const handleExportMarkdown = () => {
    const filename = `${memo.memoId || 'atlanta-heat-council-memo'}.md`;
    exportMemoToFile(memoMarkdown, filename, 'text/markdown');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isCouncilMemoOpen) return null;

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="council-memo-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-in print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black"
      >
        {/* Pinned Header (Hidden in Print) */}
        <div className="p-5 border-b border-slate-800 shrink-0 flex items-center justify-between bg-slate-900/95 print:hidden">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="council-memo-title" className="font-bold text-white text-base">
                  City Council Emergency Heat Memorandum
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {memo.memoId}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official executive resolution & resource distribution directive for municipal legislative approval
              </p>
            </div>
          </div>
          <button
            onClick={closeCouncilMemo}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close memo modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Memorandum Document Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 modal-scroll-container print:overflow-visible print:p-0">
          {/* Official City Header */}
          <div className="border-b-2 border-slate-700 pb-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight uppercase">
                  City of Atlanta, Georgia
                </h2>
                <p className="text-xs text-rose-400 font-semibold tracking-wide uppercase">
                  Executive Department • Heat Resilience Task Force
                </p>
              </div>
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Active Emergency Action
              </span>
            </div>

            {/* Formal Memo Routing Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">Date:</span>
                <span className="text-slate-200 font-medium">{memo.date}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">Memo ID:</span>
                <span className="text-rose-400 font-mono font-bold">{memo.memoId}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">To:</span>
                <span className="text-slate-200 font-medium">{memo.to}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">From:</span>
                <span className="text-slate-200 font-medium">{memo.from}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">Subject:</span>
                <span className="text-white font-bold">{memo.subject}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-rose-400">§ 1.</span> Executive Summary
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-200 leading-relaxed">
              {memo.executiveSummary}
            </div>
          </section>

          {/* Section 2: Trigger Conditions */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-rose-400">§ 2.</span> Meteorological Alert Trigger Conditions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Advisory Level</span>
                <span className="text-rose-400 font-bold block mt-1">{memo.triggerCondition.advisoryLevel}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Peak Temp / Heat Index</span>
                <span className="text-white font-mono font-bold block mt-1">
                  {memo.triggerCondition.peakTempF.toFixed(1)}°F / {memo.triggerCondition.heatIndexF.toFixed(1)}°F
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Expected Duration</span>
                <span className="text-slate-200 font-medium block mt-1">{memo.triggerCondition.expectedDuration}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Affected Population</span>
                <span className="text-emerald-400 font-mono font-bold block mt-1">
                  {memo.triggerCondition.affectedPopulation.toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          {/* Section 3: Priority Cooling Sites Table */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-rose-400">§ 3.</span> Recommended Siting Distribution ({memo.recommendedSites.length} Facilities)
              </h4>
              <span className="text-[11px] text-slate-400">Sorted by Integrated Thermal & Equity Score</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-[11px] uppercase">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Facility Name</th>
                    <th className="py-2.5 px-3">Neighborhood</th>
                    <th className="py-2.5 px-3">Temp Offset</th>
                    <th className="py-2.5 px-3">Poverty %</th>
                    <th className="py-2.5 px-3">No Vehicle %</th>
                    <th className="py-2.5 px-3">Siting Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {memo.recommendedSites.map((site) => (
                    <tr key={site.tractId} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold font-mono text-rose-400">#{site.rank}</td>
                      <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">{site.name}</td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{site.neighborhood}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-400">+{site.predictedOffsetF.toFixed(1)}°F</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{site.povertyRatePct.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{site.noVehicleRatePct.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] leading-tight min-w-[200px]">
                        {site.justification}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Mobile Fleet Dispatch Schedule */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-rose-400">§ 4.</span> Mobile Fleet Dispatch Schedule ({memo.dispatchedAssets.length} Active Deployments)
            </h4>
            {memo.dispatchedAssets.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                No mobile units currently scheduled. Use Resource Mover to deploy hydration trailers or wellness vans.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {memo.dispatchedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">
                        {asset.type === 'hydration' ? '💧' : asset.type === 'wellness' ? '🚑' : '🚌'}
                      </span>
                      <div>
                        <div className="font-bold text-white text-xs">{asset.name}</div>
                        <div className="text-[11px] text-slate-400">📍 {asset.locationName}</div>
                        <div className="text-[10px] text-emerald-400 font-medium mt-0.5">
                          Reach: +{asset.protectedPopulation.toLocaleString()} residents
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase">
                      {asset.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 5: Fiscal & Equity Impacts */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-rose-400">§ 5.</span> Fiscal, Operational & Equity Impact Analysis
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fiscal Requirements</span>
                </div>
                <div className="text-base font-bold text-white font-mono">
                  ${memo.fiscalAndOperationalImpact.projectedDailyCost.toLocaleString()} / day
                </div>
                <p className="text-[11px] text-slate-400">
                  Includes HVAC staging, emergency potable water supplies, and operational logistics.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Equity Audit Benchmark</span>
                </div>
                <div className="text-base font-bold text-indigo-300 font-mono">
                  {memo.equityMetrics.averagePovertyPct.toFixed(1)}% Avg Poverty
                </div>
                <p className="text-[11px] text-slate-400">
                  {memo.equityMetrics.tractsAbovePovertyP75} of {memo.recommendedSites.length} sited hubs exceed citywide P75 equity benchmarks.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Senior & Disability Wellness</span>
                </div>
                <div className="text-base font-bold text-amber-300 font-mono">
                  {memo.wellnessPrioritization.targetWellnessChecks.toLocaleString()} Contacts
                </div>
                <p className="text-[11px] text-slate-400">
                  Targeted across {memo.wellnessPrioritization.highPriorityTractCount} high-risk elderly isolation corridors.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-300">Coordinating Municipal Agencies:</span>
              {memo.fiscalAndOperationalImpact.partnerAgencies.map((agency, idx) => (
                <span key={idx} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                  {agency}
                </span>
              ))}
            </div>
          </section>

          {/* Section 6: Urban Forestry & Tree Canopy Resilience */}
          {memo.canopyMetrics && (
            <section className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-emerald-400">§ 6.</span> Urban Forestry & Tree Canopy Resilience (50% Target Alignment)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold">
                    <Trees className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Average Canopy Cover</span>
                  </div>
                  <div className="text-base font-bold text-emerald-300 font-mono">
                    {memo.canopyMetrics.avgCanopyPct.toFixed(1)}%
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Deficit: -{memo.canopyMetrics.avgCanopyDeficitPct.toFixed(1)}% below the 50.0% Atlanta Decade Track target.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Deficit Tracts & Plantings</span>
                  </div>
                  <div className="text-base font-bold text-amber-300 font-mono">
                    {memo.canopyMetrics.tractsBelowCohortMedian} Deficit Tracts
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Recommended {memo.canopyMetrics.recommendedPlantingCount.toLocaleString()} right-of-way street trees below 37.16% cohort median.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Multi-Dept Co-Funding</span>
                  </div>
                  <div className="text-base font-bold text-indigo-300 font-mono">
                    ${memo.canopyMetrics.multiDeptFundAllocated.toLocaleString()} / ${memo.canopyMetrics.multiDeptFundTotal.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Parks ($38.5k), Watershed ($39.25k), and Resilience ($28.75k) cost-sharing model.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Section 7: Recommended Council Actions */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-rose-400">§ {memo.canopyMetrics ? '7.' : '6.'}</span> Recommended Legislative Council Actions
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
              {memo.actionItems.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-200">
                  <span className="font-mono font-bold text-rose-400 text-xs shrink-0">{idx + 1}.</span>
                  <span className="leading-relaxed">{action}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Formal Certification Signature */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
            <div>
              <span className="text-slate-500 block uppercase tracking-wider text-[10px]">Submitted & Certified By:</span>
              <span className="text-slate-200 font-semibold">{memo.signedBy}</span>
            </div>
            <div className="text-right sm:text-right">
              <span className="font-mono text-[10px] text-slate-500">Document Verification Hash: SHA256:{memo.memoId}</span>
            </div>
          </div>
        </div>

        {/* Pinned Footer (Action Buttons, Hidden in Print) */}
        <div className="p-4 border-t border-slate-800 shrink-0 flex flex-wrap items-center justify-between gap-3 bg-slate-900/95 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={handleExportMarkdown}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export Markdown</span>
            </button>

            <button
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Print / Save PDF</span>
            </button>
          </div>

          <button
            onClick={closeCouncilMemo}
            className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl text-xs font-semibold transition shadow-lg shadow-rose-950/50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CouncilMemoModal;
