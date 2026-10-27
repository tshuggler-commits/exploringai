import React, { useState } from 'react';
import { ShieldAlert, X, CheckCircle2 } from 'lucide-react';
import { HeatAlert } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface HeatAlertBannerProps {
  alerts: HeatAlert[];
  baselineTempF: number;
}

export const HeatAlertBanner: React.FC<HeatAlertBannerProps> = ({ alerts, baselineTempF }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { modalRef, handleBackdropClick } = useModalDismiss({
    isOpen: isModalOpen,
    onClose: () => setIsModalOpen(false),
  });

  return (
    <>
      {/* Alert Ticker Bar */}
      <div className="bg-gradient-to-r from-amber-950/90 via-rose-950/90 to-red-950/90 border-b border-rose-800/40 px-4 py-2 flex items-center justify-between text-xs z-40 relative">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="flex h-2.5 w-2.5 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span className="bg-rose-500/20 text-rose-300 font-semibold px-2 py-0.5 rounded border border-rose-500/40 uppercase tracking-wide text-[10px] shrink-0">
            NWS Heat Advisory Stage 3
          </span>
          <div className="truncate text-slate-200">
            <span className="font-semibold text-amber-200">Metro Heat Index: {(baselineTempF + 2.6).toFixed(1)}°F</span>
            <span className="mx-2 text-slate-500">•</span>
            <span>Hotspots Active: Thomasville Heights (+1.26°F), Bankhead (+0.98°F), Campbellton (+1.30°F)</span>
            <span className="mx-2 text-slate-500">•</span>
            <span className="text-rose-300 font-medium">Transit wait-time exposure risk: Severe</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-slate-400 hidden sm:inline text-[11px]">
            Baseline: <strong className="text-white font-mono">{baselineTempF.toFixed(1)}°F</strong>
          </span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-rose-300 hover:text-white underline text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            View {alerts.length} Alerts
          </button>
        </div>
      </div>

      {/* Alerts Modal with P0 constrained layout & outside click / Esc dismiss */}
      {isModalOpen && (
        <div
          onClick={handleBackdropClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="heat-advisories-title"
        >
          <div
            ref={modalRef}
            className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
          >
            {/* Pinned Header */}
            <div className="p-5 border-b border-slate-800 shrink-0 flex items-center justify-between bg-slate-900/95">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <div>
                  <h3 id="heat-advisories-title" className="font-bold text-white text-base">
                    Active Municipal Heat Advisories
                  </h3>
                  <p className="text-xs text-slate-400">Emergency Operations Center • City of Atlanta</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3 modal-scroll-container">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    alert.severity === 'warning'
                      ? 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                      : alert.severity === 'spike'
                      ? 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                      : 'bg-indigo-950/30 border-indigo-800/40 text-indigo-200'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="tracking-tight text-white">{alert.title}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-950/60 border border-slate-700 text-slate-300">
                      {alert.zone}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2 leading-relaxed">{alert.description}</p>
                  <div className="flex items-start gap-1.5 text-[11px] font-medium text-emerald-300 bg-slate-950/40 p-2 rounded-lg border border-emerald-900/40">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
                    <span>{alert.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pinned Footer */}
            <div className="p-4 border-t border-slate-800 shrink-0 flex items-center justify-between bg-slate-900/95">
              <span className="text-xs text-slate-400">
                {alerts.length} active directives under NWS Stage 3 protocol
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-lg shadow-rose-950/50"
                >
                  Acknowledge Directives
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
