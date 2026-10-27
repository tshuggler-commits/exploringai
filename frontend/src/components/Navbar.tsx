import React from 'react';
import { Flame, Activity, RefreshCw, Database, HelpCircle } from 'lucide-react';
import { HeatAlert } from '../types';
import { HeatAlertBanner } from './HeatAlertBanner';
import { useUI } from '../context/UIContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCloudRunConnected: boolean;
  latencyMs: number;
  useMockMode: boolean;
  setUseMockMode: (val: boolean) => void;
  onRefreshHealth: () => void;
  cloudRunUrl: string;
  alerts: HeatAlert[];
  baselineTempF: number;
  pendingDecisionsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isCloudRunConnected,
  latencyMs,
  useMockMode,
  setUseMockMode,
  onRefreshHealth,
  cloudRunUrl,
  alerts,
  baselineTempF,
  pendingDecisionsCount = 0,
}) => {
  const { openGlossary } = useUI();

  const tabs = [
    { id: 'map', label: 'Map & Walkability', icon: '🗺️' },
    { 
      id: 'decisions', 
      label: 'Decisions & Dispatch', 
      icon: '⚡',
      badge: pendingDecisionsCount > 0 ? pendingDecisionsCount : undefined 
    },
    { id: 'siting', label: 'Siting & Recommendations', icon: '🎯' },
    { id: 'equity', label: 'Equity Audit', icon: '⚖️' },
    { id: 'history', label: 'Climate & Trends', icon: '📈' },
    { id: 'advisor', label: 'AI Advisor Agent', icon: '🤖' },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
      {/* Top Heat Alert Ticker Banner */}
      <HeatAlertBanner alerts={alerts} baselineTempF={baselineTempF} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & City Title */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-amber-500 to-emerald-400 p-0.5 shadow-lg shadow-rose-950/50">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white tracking-tight text-lg">Atlanta Heat Resilience</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Challenge 1
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Urban Climate Walkability & Siting Advisor • Vertex AI & BigQuery ML
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Help & Glossary Button */}
            <button
              type="button"
              onClick={() => openGlossary()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 hover:text-white text-xs font-medium transition-all shadow-sm cursor-pointer"
              title="Open Urban Heat & Equity Metric Glossary"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">? Help & Glossary</span>
              <span className="sm:hidden">? Help</span>
            </button>

            {/* Cloud Run Service Status Badge */}
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                isCloudRunConnected
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/40'
              }`}
              onClick={onRefreshHealth}
              title={`Live Endpoint: ${cloudRunUrl}\nClick to re-ping`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isCloudRunConnected ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isCloudRunConnected ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
              </span>
              <span className="font-mono hidden md:inline">Cloud Run: {isCloudRunConnected ? 'LIVE' : 'OFFLINE'}</span>
              <span className="font-mono md:hidden">{isCloudRunConnected ? 'LIVE' : 'OFF'}</span>
              {latencyMs > 0 && <span className="text-slate-400 font-mono text-[10px] hidden sm:inline">({latencyMs}ms)</span>}
              <RefreshCw className="w-3 h-3 text-slate-400 hover:text-white ml-1" />
            </div>

            {/* Data Source Toggle */}
            <div className="hidden lg:flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => setUseMockMode(false)}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1.5 ${
                  !useMockMode
                    ? 'bg-rose-600 text-white font-medium shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Connect directly to deployed Cloud Run Agent endpoint"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Live Agent API</span>
              </button>
              <button
                type="button"
                onClick={() => setUseMockMode(true)}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1.5 ${
                  useMockMode
                    ? 'bg-slate-700 text-white font-medium shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Use realistic local mock data schema while SQL backend is finalizing"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Mock Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
