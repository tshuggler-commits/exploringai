import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Truck, 
  ShieldCheck, 
  Users, 
  MapPin, 
  CheckCircle2, 
  FileText, 
  Clock,
  ArrowRight,
  Trees,
  Sprout,
  Check
} from 'lucide-react';
import { PlannerDecision, DispatchedAsset, AssetType, CensusTract } from '../types';
import { useUI } from '../context/UIContext';
import {
  calculateTractCanopyMetrics,
  calculateDepartmentSplit,
  COHORT_MEDIAN_CANOPY_PCT,
} from '../services/canopyService';

interface DecisionsAndDispatchProps {
  decisions: PlannerDecision[];
  dispatchedAssets: DispatchedAsset[];
  onExecuteDecision: (decision: PlannerDecision) => void;
  onDeployAsset: (type: AssetType, locationName: string, lat: number, lng: number, tractId?: string) => void;
  onRecallAsset: (id: string) => void;
  onSelectTractForMap: (tractId: string) => void;
  onDraftCouncilProposal: () => void;
  allTracts: CensusTract[];
}

export const DecisionsAndDispatch: React.FC<DecisionsAndDispatchProps> = ({
  decisions,
  dispatchedAssets,
  onExecuteDecision,
  onDeployAsset,
  onRecallAsset,
  onSelectTractForMap,
  onDraftCouncilProposal,
  allTracts,
}) => {
  const { openCouncilMemo } = useUI();
  const [activeSubTab, setActiveSubTab] = useState<'decisions' | 'resources' | 'greening'>('decisions');

  // Multi-Departmental Greening Budgets State (starts at requested baseline: Parks $38.5k/40k, Watershed $39.25k/50k, Resilience $28.75k/30k)
  const PARKS_CAP = 40000;
  const WATERSHED_CAP = 50000;
  const RESILIENCE_CAP = 30000;
  const TOTAL_CAP = 120000;

  const [parksSpent, setParksSpent] = useState<number>(38500);
  const [watershedSpent, setWatershedSpent] = useState<number>(39250);
  const [resilienceSpent, setResilienceSpent] = useState<number>(28750);
  const [approvedGreeningTractIds, setApprovedGreeningTractIds] = useState<string[]>([]);
  const [greeningNotification, setGreeningNotification] = useState<string | null>(null);

  // Candidate Priority Tracts for Greening Dispatch
  const greeningCandidateTracts = useMemo(() => {
    return allTracts
      .filter((t) => (t.treeCanopyPct ?? 35) < COHORT_MEDIAN_CANOPY_PCT || t.predictedOffsetF >= 3.0)
      .map((tract) => {
        const metrics = calculateTractCanopyMetrics(tract);
        const split = calculateDepartmentSplit(metrics);
        return {
          tract,
          metrics,
          split,
        };
      })
      .sort((a, b) => b.metrics.targetGapPct - a.metrics.targetGapPct);
  }, [allTracts]);

  const handleApproveGreening = (geoId: string, split: ReturnType<typeof calculateDepartmentSplit>, neighborhood: string) => {
    if (approvedGreeningTractIds.includes(geoId)) return;

    setParksSpent((prev) => Math.min(PARKS_CAP, prev + split.contributions.parks));
    setWatershedSpent((prev) => Math.min(WATERSHED_CAP, prev + split.contributions.watershed));
    setResilienceSpent((prev) => Math.min(RESILIENCE_CAP, prev + split.contributions.resilience));
    setApprovedGreeningTractIds((prev) => [...prev, geoId]);

    setGreeningNotification(`Approved $1,500 greening allocation for ${neighborhood}! Budget drawn down.`);
    setTimeout(() => setGreeningNotification(null), 3500);
  };

  // Custom dispatch modal/form
  const [showCustomDeploy, setShowCustomDeploy] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>('hydration');
  const [targetTractGeoId, setTargetTractGeoId] = useState<string>(allTracts[0]?.geoId || '13121006802');

  // Calculate live impact metrics
  const totalProtectedPopulation = dispatchedAssets.reduce((sum, a) => sum + a.protectedPopulation, 0) + 4250;
  const equityTargetRatePct = 88.4;

  // Counts of available inventory (base minus deployed)
  const deployedCounts = {
    hydration: dispatchedAssets.filter((a) => a.type === 'hydration').length,
    wellness: dispatchedAssets.filter((a) => a.type === 'wellness').length,
    bus: dispatchedAssets.filter((a) => a.type === 'bus').length,
  };

  const inventory = [
    {
      type: 'hydration' as AssetType,
      name: 'Potable Hydration Trailer',
      description: '1,000-gal chilled potable water reservoir + electrolyte misting fans',
      total: 5,
      available: Math.max(0, 5 - deployedCounts.hydration),
      icon: '💧',
      color: 'amber',
    },
    {
      type: 'wellness' as AssetType,
      name: 'Mobile Wellness Van',
      description: 'Paramedic triage team + cooling ice vests + hydration assessment',
      total: 4,
      available: Math.max(0, 4 - deployedCounts.wellness),
      icon: '🚑',
      color: 'indigo',
    },
    {
      type: 'bus' as AssetType,
      name: 'MARTA Climate Shelter Bus',
      description: 'Dedicated air-conditioned 68°F shelter bus staged at transit desert stops',
      total: 4,
      available: Math.max(0, 4 - deployedCounts.bus),
      icon: '🚌',
      color: 'cyan',
    },
  ];

  const handleCustomDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tract = allTracts.find((t) => t.geoId === targetTractGeoId);
    if (!tract) return;
    onDeployAsset(
      selectedAssetType,
      `${tract.neighborhood} (${tract.name})`,
      tract.latitude,
      tract.longitude,
      tract.geoId
    );
    setShowCustomDeploy(false);
  };

  const pendingDecisionsCount = decisions.filter((d) => d.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header & Sub-tab Switcher */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Zap className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Planner Action Deck: Decisions & Resource Mover
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Triage immediate municipal heat actions and deploy mobile cooling assets directly into verified thermal hotspots.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveSubTab('decisions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'decisions'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚡ Decisions Needed</span>
              {pendingDecisionsCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {pendingDecisionsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab('resources')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'resources'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🚛 Resource Mover</span>
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0.2 rounded border border-indigo-500/30 font-mono">
                {dispatchedAssets.length} Active
              </span>
            </button>
            <button
              onClick={() => setActiveSubTab('greening')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'greening'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🌳 Urban Greening &amp; NBS</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded border border-emerald-500/30 font-mono">
                $120k Pool
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Impact Counters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Protected Population</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
            {totalProtectedPopulation.toLocaleString()}
          </p>
          <span className="text-[11px] text-emerald-300/80 mt-0.5 block">
            +{(dispatchedAssets.length * 2100).toLocaleString()} residents covered via mobile dispatches
          </span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Equity Target Rate</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-400 mt-1 font-mono">{equityTargetRatePct}%</p>
          <span className="text-[11px] text-indigo-300/80 mt-0.5 block">
            Exceeds City of Atlanta 75th percentile vulnerability criteria
          </span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">City Council Memo</span>
            <FileText className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                openCouncilMemo({
                  dispatchedAssets,
                  sites: allTracts.filter((t) => t.hasCoolingCenter),
                });
                if (onDraftCouncilProposal) {
                  onDraftCouncilProposal();
                }
              }}
              className="flex-1 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              <span>Draft Council Memo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: DECISIONS NEEDED */}
      {activeSubTab === 'decisions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span>Immediate Municipal Triage Actions</span>
              <span className="text-xs font-normal text-slate-400 lowercase">({decisions.length} items logged)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {decisions.map((dec) => {
              const isExecuted = dec.status === 'executed';
              return (
                <div
                  key={dec.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isExecuted
                      ? 'bg-slate-900/40 border-slate-800 opacity-75'
                      : 'bg-slate-900/90 border-slate-700/80 shadow-md hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        dec.category === 'Immediate'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : dec.category === 'Mobile Surge'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : dec.category === 'Transit Desert'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      }`}
                    >
                      {dec.category}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dec.dueTime}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-1">{dec.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">{dec.description}</p>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-emerald-400 font-medium">
                      Protect: {dec.impactPopulation.toLocaleString()} residents
                    </span>

                    <div className="flex items-center gap-2">
                      {dec.tractId && (
                        <button
                          onClick={() => onSelectTractForMap(dec.tractId!)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg transition"
                          title="View tract on tactical map"
                        >
                          Map
                        </button>
                      )}

                      {isExecuted ? (
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-800/40">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Executed
                        </span>
                      ) : (
                        <button
                          onClick={() => onExecuteDecision(dec)}
                          className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow"
                        >
                          {dec.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: RESOURCE MOVER / DISPATCHER */}
      {activeSubTab === 'resources' && (
        <div className="space-y-6">
          {/* Inventory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {inventory.map((item) => (
              <div
                key={item.type}
                className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="font-mono text-xs font-bold text-amber-300 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                      {item.available} / {item.total} Ready
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{item.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">Deployment time: ~15m</span>
                  <button
                    onClick={() => {
                      setSelectedAssetType(item.type);
                      setShowCustomDeploy(true);
                    }}
                    disabled={item.available <= 0}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    Deploy Unit
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Active Mobile Field Units List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Active Mobile Dispatches ({dispatchedAssets.length})</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Live telemetry linked to Tactical Map</span>
            </div>

            {dispatchedAssets.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No mobile units currently deployed. Use the inventory above or Decisions Needed to dispatch units.
              </p>
            ) : (
              <div className="space-y-2.5">
                {dispatchedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {asset.type === 'hydration' ? '💧' : asset.type === 'wellness' ? '🚑' : '🚌'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{asset.name}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {asset.status === 'on-site' ? 'On Site' : 'En Route'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{asset.locationName}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-emerald-400">+{asset.protectedPopulation.toLocaleString()} residents</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {asset.tractId && (
                        <button
                          onClick={() => onSelectTractForMap(asset.tractId!)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg transition"
                        >
                          Focus on Map
                        </button>
                      )}
                      <button
                        onClick={() => onRecallAsset(asset.id)}
                        className="bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 text-xs px-2.5 py-1.5 rounded-lg transition"
                        title="Recall mobile asset back to base"
                      >
                        Recall
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: URBAN GREENING & NATURE-BASED SOLUTIONS */}
      {activeSubTab === 'greening' && (
        <div className="space-y-6">
          {greeningNotification && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{greeningNotification}</span>
            </div>
          )}

          {/* Multi-Departmental Cost-Sharing Budget Overview */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Trees className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Multi-Departmental Cost-Sharing Budget Overview
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  $120,000 multi-agency funding pool for Right-of-Way (ROW) street tree planting and Nature-Based Solutions (NBS).
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Total Pool Drawdown</span>
                <span className="font-mono font-bold text-white text-base">
                  ${(parksSpent + watershedSpent + resilienceSpent).toLocaleString()} / ${TOTAL_CAP.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-400 block font-mono">
                  {(((parksSpent + watershedSpent + resilienceSpent) / TOTAL_CAP) * 100).toFixed(1)}% Allocated
                </span>
              </div>
            </div>

            {/* Department Budget Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Office of Parks */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <span>🌳</span>
                    <span>Office of Parks</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {((parksSpent / PARKS_CAP) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-mono text-white font-bold text-sm">
                    ${parksSpent.toLocaleString()}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    / ${PARKS_CAP.toLocaleString()} Cap
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="budget-bar-parks"
                    style={{ width: `${Math.min(100, (parksSpent / PARKS_CAP) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Remaining: <b className="text-emerald-300">${(PARKS_CAP - parksSpent).toLocaleString()}</b></span>
                  <span className="truncate ml-1 text-slate-500" title="Criteria: Tree Canopy < 37.16%">Canopy &lt; 37.16%</span>
                </div>
              </div>

              {/* Dept of Watershed Management */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span>💧</span>
                    <span>Watershed Management</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    {((watershedSpent / WATERSHED_CAP) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-mono text-white font-bold text-sm">
                    ${watershedSpent.toLocaleString()}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    / ${WATERSHED_CAP.toLocaleString()} Cap
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="budget-bar-watershed"
                    style={{ width: `${Math.min(100, (watershedSpent / WATERSHED_CAP) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Remaining: <b className="text-cyan-300">${(WATERSHED_CAP - watershedSpent).toLocaleString()}</b></span>
                  <span className="truncate ml-1 text-slate-500" title="Criteria: Pop Density > 5,141.4 / sq mi">Pop &gt; 5.1k / sq mi</span>
                </div>
              </div>

              {/* Office of Resilience */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>Office of Resilience</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-400">
                    {((resilienceSpent / RESILIENCE_CAP) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-mono text-white font-bold text-sm">
                    ${resilienceSpent.toLocaleString()}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    / ${RESILIENCE_CAP.toLocaleString()} Cap
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="budget-bar-resilience"
                    style={{ width: `${Math.min(100, (resilienceSpent / RESILIENCE_CAP) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Remaining: <b className="text-indigo-300">${(RESILIENCE_CAP - resilienceSpent).toLocaleString()}</b></span>
                  <span className="truncate ml-1 text-slate-500" title="Criteria: CDC SVI > 0.50">SVI &gt; 0.50 Equity</span>
                </div>
              </div>
            </div>
          </div>

          {/* Greening Project Dispatch: Candidate Priority Tracts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-emerald-400" />
                  <span>Greening Project Dispatch: Priority Candidate Tracts</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Candidate tracts prioritized by canopy deficit gap, thermal offset, and inter-departmental co-funding qualification.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {greeningCandidateTracts.length} Candidates
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {greeningCandidateTracts.map(({ tract, metrics, split }) => {
                const isApproved = approvedGreeningTractIds.includes(tract.geoId);

                return (
                  <div
                    key={tract.geoId}
                    className={`p-4 rounded-xl border transition-all ${
                      isApproved
                        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white">{tract.neighborhood}</h4>
                          <span className="text-[10px] font-mono text-slate-400">GEOID: {tract.geoId}</span>
                        </div>
                        <div className="text-xs text-rose-400 font-medium mt-0.5">
                          Heat Offset: +{tract.predictedOffsetF}°F above baseline
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                          metrics.targetGapPct >= 20
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        Gap: -{metrics.targetGapPct}%
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 my-2.5 text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Canopy Cover:</span>
                        <span className="font-mono font-bold text-emerald-400">{metrics.treeCanopyPct}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Plantable ROW:</span>
                        <span className="font-mono font-semibold text-slate-200">{(metrics.plantableRowSqm ?? 0).toLocaleString()} m²</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Marginal Cost:</span>
                        <span className="font-mono font-semibold text-slate-200">${metrics.marginalPlantingCost ?? 650}/tree</span>
                      </div>
                    </div>

                    {/* Multi-Departmental Co-Funding Breakdown */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/70">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                          $1,500 Grant Share ({split.eligibleDepts.length} Depts):
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          ${split.splitAmount}/dept
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                            metrics.isParksEligible
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-950 text-slate-600 border-slate-800 line-through'
                          }`}
                        >
                          🌳 Parks: ${split.contributions.parks}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                            metrics.isWatershedEligible
                              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                              : 'bg-slate-950 text-slate-600 border-slate-800 line-through'
                          }`}
                        >
                          💧 Watershed: ${split.contributions.watershed}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                            metrics.isResilienceEligible
                              ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
                              : 'bg-slate-950 text-slate-600 border-slate-800 line-through'
                          }`}
                        >
                          🛡️ Resilience: ${split.contributions.resilience}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectTractForMap(tract.geoId)}
                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>View Map</span>
                      </button>

                      {isApproved ? (
                        <div className="flex-1 py-1.5 px-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Approved ✓ ($1,500 Allocated)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApproveGreening(tract.geoId, split, tract.neighborhood)}
                          className="flex-1 py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition shadow shadow-emerald-950/50 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Trees className="w-3.5 h-3.5" />
                          <span>Approve Tract Greening ($1,500)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Dispatch Modal */}
      {showCustomDeploy && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1">Dispatch Mobile Climate Asset</h3>
            <p className="text-xs text-slate-400 mb-4">
              Direct mobile resilience infrastructure into high thermal offset census tracts.
            </p>

            <form onSubmit={handleCustomDispatchSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Asset Type</label>
                <select
                  value={selectedAssetType}
                  onChange={(e) => setSelectedAssetType(e.target.value as AssetType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="hydration">💧 Hydration Station Trailer (1,000 gal)</option>
                  <option value="wellness">🚑 Mobile Wellness Van (Paramedic Triage)</option>
                  <option value="bus">🚌 MARTA Cooling Bus (68°F Shelter)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Destination Target Tract</label>
                <select
                  value={targetTractGeoId}
                  onChange={(e) => setTargetTractGeoId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {allTracts.map((tract) => (
                    <option key={tract.geoId} value={tract.geoId}>
                      {tract.neighborhood} (Offset: +{tract.predictedOffsetF}°F | Poverty: {tract.povertyRatePct}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomDeploy(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow"
                >
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
