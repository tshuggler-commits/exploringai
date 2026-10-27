import React, { useState, useMemo } from 'react';
import { CoolingCenterRanking, FormulaWeights, RankingScenarioPreset } from '../types';
import { recalculateRankings, RANKING_PRESETS, EQUALIZED_BASELINE } from '../services/riskService';
import { 
  Award, 
  Thermometer, 
  ShieldAlert, 
  Footprints, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  Sliders,
  Flame,
  Users,
  Building2,
  Bus,
  RotateCcw
} from 'lucide-react';

interface CoolingCenterRankingsProps {
  rankings: CoolingCenterRanking[];
  forecastBaselineF: number;
  setForecastBaselineF: (temp: number) => void;
  onSelectRanking: (rank: CoolingCenterRanking) => void;
  onAuditRecommendations: (selectedRanks: CoolingCenterRanking[]) => void;
  onDraftCouncilProposal: (selectedRanks: CoolingCenterRanking[]) => void;
}

export const CoolingCenterRankings: React.FC<CoolingCenterRankingsProps> = ({
  rankings,
  forecastBaselineF,
  setForecastBaselineF,
  onSelectRanking,
  onAuditRecommendations,
  onDraftCouncilProposal,
}) => {
  const [fundingSlots, setFundingSlots] = useState<number>(3);
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(true);
  const [weights, setWeights] = useState<FormulaWeights>(EQUALIZED_BASELINE.weights);
  const [activePresetId, setActivePresetId] = useState<string>(EQUALIZED_BASELINE.id);

  // Switch between predefined scenarios
  const handleSelectPreset = (preset: RankingScenarioPreset) => {
    setActivePresetId(preset.id);
    setWeights({ ...preset.weights });
  };

  // Live adjustments via interactive sliders
  const handleWeightChange = (key: keyof FormulaWeights, valuePct: number) => {
    setWeights((prev) => ({
      ...prev,
      [key]: valuePct / 100,
    }));
    setActivePresetId('custom');
  };

  const handleResetToBaseline = () => {
    setActivePresetId(EQUALIZED_BASELINE.id);
    setWeights({ ...EQUALIZED_BASELINE.weights });
  };

  // Recalculate rankings dynamically based on custom weights and baseline temperature
  const rankedCandidates = useMemo(() => {
    return recalculateRankings(rankings, weights, forecastBaselineF);
  }, [rankings, weights, forecastBaselineF]);

  const selectedCandidates = rankedCandidates.slice(0, fundingSlots);

  const totalWeightPct = Math.round(
    (weights.heat + weights.svi + weights.density + weights.facility + weights.transit) * 100
  );

  return (
    <div className="space-y-6">
      {/* Top Banner: Siting Optimizer Controls & Multi-Criteria Scenario Engine */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Award className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Cooling Center Siting Optimization
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Multi-criteria prioritization fusing BigQuery ML spatial thermal offsets, CDC social vulnerability, population density, facility deficits, and transit access.
            </p>
          </div>

          {/* Interactive Scenario Controls */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            {/* Funding Allocation (N Centers) */}
            <div className="text-xs">
              <span className="text-slate-400 block mb-1">Funded Siting Slots:</span>
              <div className="flex space-x-1">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFundingSlots(n)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-all cursor-pointer ${
                      fundingSlots === n
                        ? 'bg-rose-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>

            {/* City Baseline Forecast Slider */}
            <div className="text-xs min-w-[200px]">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Citywide Forecast:</span>
                <span className="font-mono font-bold text-amber-400">{forecastBaselineF}°F</span>
              </div>
              <input
                type="range"
                min="85"
                max="105"
                step="1"
                value={forecastBaselineF}
                onChange={(e) => setForecastBaselineF(parseInt(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Scenario Presets Selector */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                Scenario Presets:
              </span>
            </div>
            {activePresetId === 'custom' && (
              <button
                type="button"
                onClick={handleResetToBaseline}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Equalized Baseline</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {RANKING_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs leading-tight">{preset.name}</span>
                    {isSelected && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Multi-Criteria Weight Sliders */}
        <div className="pt-3 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowFormulaDetails(!showFormulaDetails)}
              className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Multi-Criteria Weights Tuning{' '}
                <strong className="text-slate-400 font-normal">
                  ({showFormulaDetails ? 'Hide Controls' : 'Show Controls'})
                </strong>
              </span>
            </button>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Total Weight:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                  totalWeightPct === 100
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {totalWeightPct}%
              </span>
            </div>
          </div>

          {showFormulaDetails && (
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Heat Exposure */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-rose-300">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      <span>Heat Exposure</span>
                    </span>
                    <span className="font-mono font-bold text-rose-400">
                      {Math.round(weights.heat * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={Math.round(weights.heat * 100)}
                    onChange={(e) => handleWeightChange('heat', parseFloat(e.target.value))}
                    className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block">NOAA microclimate delta</span>
                </div>

                {/* 2. CDC SVI */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-purple-300">
                      <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                      <span>CDC SVI (Equity)</span>
                    </span>
                    <span className="font-mono font-bold text-purple-400">
                      {Math.round(weights.svi * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={Math.round(weights.svi * 100)}
                    onChange={(e) => handleWeightChange('svi', parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block">Social Vulnerability Index</span>
                </div>

                {/* 3. Pop Density */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-amber-300">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>Population Density</span>
                    </span>
                    <span className="font-mono font-bold text-amber-400">
                      {Math.round(weights.density * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={Math.round(weights.density * 100)}
                    onChange={(e) => handleWeightChange('density', parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block">Residential concentration</span>
                </div>

                {/* 4. Facility Distance */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-sky-300">
                      <Building2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Facility Distance</span>
                    </span>
                    <span className="font-mono font-bold text-sky-400">
                      {Math.round(weights.facility * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={Math.round(weights.facility * 100)}
                    onChange={(e) => handleWeightChange('facility', parseFloat(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block">Cooling deficit / desert</span>
                </div>

                {/* 5. Transit Distance */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-emerald-300">
                      <Bus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Transit Distance</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {Math.round(weights.transit * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={Math.round(weights.transit * 100)}
                    onChange={(e) => handleWeightChange('transit', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block">MARTA connectivity gap</span>
                </div>
              </div>

              {totalWeightPct !== 100 && (
                <div className="text-[11px] text-amber-300/90 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span>
                    Weights currently sum to {totalWeightPct}%. The engine automatically normalizes all factors proportionally to sum to 100.0%.
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToBaseline}
                    className="text-amber-400 hover:text-white underline ml-2 shrink-0 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ranked Candidate Cards Table */}
      <div className="grid grid-cols-1 gap-4">
        {rankedCandidates.map((site) => {
          const isFunded = site.rank <= fundingSlots;
          const localizedTemp = site.localizedTempF ?? Number((forecastBaselineF + site.predictedOffsetF).toFixed(1));
          const integratedRisk = site.integratedRiskScore ?? site.compositeScore;

          return (
            <div
              key={site.tractId}
              onClick={() => onSelectRanking(site)}
              className={`p-5 rounded-xl border transition-all cursor-pointer ${
                isFunded
                  ? 'bg-slate-900/90 border-rose-500/40 hover:border-rose-400 shadow-lg shadow-rose-950/20'
                  : 'bg-slate-950/60 border-slate-800/80 opacity-75 hover:opacity-100 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Rank & Facility Info */}
                <div className="flex items-start space-x-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-lg flex-shrink-0 ${
                      isFunded
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    #{site.rank}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-white text-base">{site.name}</h3>
                      {isFunded && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Funded Candidate</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center space-x-3 mt-1">
                      <span>{site.neighborhood}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-500">Tract {site.tractId}</span>
                      <span>•</span>
                      <span className="flex items-center space-x-1 text-sky-400">
                        <Footprints className="w-3 h-3" />
                        <span>{site.walkAccessMinutes} min walk</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 italic max-w-2xl">
                      "{site.sitingJustification}"
                    </p>
                  </div>
                </div>

                {/* Score & Heat Offset Metrics */}
                <div className="flex items-center space-x-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Microclimate Temp</div>
                    <div className="text-xl font-mono font-bold text-rose-400 flex items-center justify-end space-x-1">
                      <Thermometer className="w-4 h-4 text-rose-500" />
                      <span>{localizedTemp}°F</span>
                    </div>
                    <div className="text-[10px] text-amber-400 font-mono">
                      (+{site.predictedOffsetF}°F offset)
                    </div>
                  </div>

                  <div className="text-right pl-3 border-l border-slate-800">
                    <div className="text-xs text-slate-400">Integrated Risk</div>
                    <div className="text-xl font-mono font-bold text-indigo-400">
                      {integratedRisk.toFixed(1)}
                      <span className="text-xs text-slate-400 font-normal">/100</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Poverty: {site.povertyRatePct}% · Carless: {site.noVehicleRatePct}%
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-600 hidden lg:block" />
                </div>
              </div>

              {/* Dynamic Formula Breakdown Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800/60 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mr-1">
                  Formula Breakdown:
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  🔥 Heat: {site.formulaBreakdown?.heat ?? (site.predictedOffsetF * 5).toFixed(1)} pts
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  🛡️ SVI: {site.formulaBreakdown?.svi ?? ((site.sviScore ?? 0.8) * 25).toFixed(1)} pts
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  👥 Density: {site.formulaBreakdown?.density ?? '14.0'} pts
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  🏛️ Facility Dist: {site.formulaBreakdown?.facility ?? '12.5'} pts
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  🚌 Transit Dist: {site.formulaBreakdown?.transit ?? '10.0'} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Decision Dock: Audit Outcome & Draft Council Memo */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <ShieldAlert className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-xs font-bold text-white">Next Operational Steps:</div>
            <div className="text-[11px] text-slate-400">
              Validate climate equity benchmarks or generate legislative resolution for Council.
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => onAuditRecommendations(selectedCandidates)}
            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Audit Equity on Top {fundingSlots}</span>
          </button>
          <button
            onClick={() => onDraftCouncilProposal(selectedCandidates)}
            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Draft Council Resolution</span>
          </button>
        </div>
      </div>
    </div>
  );
};
