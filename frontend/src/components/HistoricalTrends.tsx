import React, { useState } from 'react';
import { MOCK_STATION_HEAT_HISTORY } from '../data/mockData';
import { TrendingUp, Sun, Flame, AlertCircle } from 'lucide-react';

export const HistoricalTrends: React.FC = () => {
  const [selectedThreshold, setSelectedThreshold] = useState<'95' | '90'>('95');
  const [activeYear, setActiveYear] = useState<number | null>(2024);

  const history = MOCK_STATION_HEAT_HISTORY;
  const maxDays = Math.max(...history.map((h) => (selectedThreshold === '95' ? h.daysExceeding95F : h.daysExceeding90F)));

  const activeRecord = history.find((h) => h.year === activeYear) || history[history.length - 1];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-950 border border-amber-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Historical Extreme Heat Trajectory (2018–2024)
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Multi-year GHCN daily station observations for the Atlanta metropolitan region.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedThreshold('95')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedThreshold === '95'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dangerous Days (≥ 95°F)
            </button>
            <button
              onClick={() => setSelectedThreshold('90')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedThreshold === '90'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Advisory Days (≥ 90°F)
            </button>
          </div>
        </div>
      </div>

      {/* Chart & Trend Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-sm">
                Annual Frequency of Days Exceeding {selectedThreshold}°F
              </h3>
              <span className="text-xs text-slate-400 font-mono">GHCN Station 03131</span>
            </div>

            {/* Responsive SVG Chart */}
            <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
              {history.map((record) => {
                const count = selectedThreshold === '95' ? record.daysExceeding95F : record.daysExceeding90F;
                const heightPct = Math.round((count / (maxDays * 1.15)) * 100);
                const isSelected = activeYear === record.year;

                return (
                  <div
                    key={record.year}
                    onClick={() => setActiveYear(record.year)}
                    className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group"
                  >
                    {/* Hover or selected tooltip badge */}
                    <span
                      className={`text-[11px] font-mono font-bold mb-1 transition-all ${
                        isSelected ? 'text-rose-400 scale-110' : 'text-slate-400 group-hover:text-white'
                      }`}
                    >
                      {count}d
                    </span>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-lg transition-all ${
                        isSelected
                          ? selectedThreshold === '95'
                            ? 'bg-gradient-to-t from-rose-700 to-rose-400 shadow-lg shadow-rose-950/50'
                            : 'bg-gradient-to-t from-amber-700 to-amber-400'
                          : selectedThreshold === '95'
                          ? 'bg-rose-950/80 hover:bg-rose-800/80 border border-rose-500/20'
                          : 'bg-amber-950/80 hover:bg-amber-800/80 border border-amber-500/20'
                      }`}
                    ></div>

                    {/* Year Label */}
                    <span
                      className={`text-xs font-mono mt-2 transition-colors ${
                        isSelected ? 'text-white font-bold' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    >
                      {record.year}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-2">
            <span>Click any year bar to view details</span>
            <span className="font-mono text-rose-400 font-semibold">
              +177% increase in ≥95°F days (2018 vs 2024)
            </span>
          </div>
        </div>

        {/* Selected Year Insight Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-mono text-slate-400">YEAR SUMMARY</span>
              <span className="text-xl font-mono font-bold text-white">{activeRecord.year}</span>
            </div>

            <div className="space-y-4 mt-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Flame className="w-4 h-4 text-rose-500" />
                  <span>Days ≥ 95°F:</span>
                </div>
                <span className="font-mono font-bold text-rose-400 text-base">
                  {activeRecord.daysExceeding95F} days
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Days ≥ 90°F:</span>
                </div>
                <span className="font-mono font-bold text-amber-400 text-base">
                  {activeRecord.daysExceeding90F} days
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <span>Peak Summer High:</span>
                </div>
                <span className="font-mono font-bold text-white text-base">
                  {activeRecord.peakTempF}°F
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span>Avg Summer Max:</span>
                </div>
                <span className="font-mono font-bold text-slate-300 text-base">
                  {activeRecord.avgSummerMaxF}°F
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 text-xs text-rose-200 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="leading-tight">
              A baseline day of 95°F at the airport yields microclimate street temperatures exceeding <b>99°F to 100°F</b> in South Pryor and Thomasville Heights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
