import React from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import type { RankingEvidence } from '../types';

interface Props {
  evidence: RankingEvidence;
  isMock: boolean;
  disabled: boolean;
  onAudit: (prompt: string) => void;
}

export const RecommendationCards: React.FC<Props> = ({ evidence, isMock, disabled, onAudit }) => (
  <section aria-label="Ranked site evidence" className="mb-4 space-y-3">
    <header>
      <h4 className="font-semibold text-white">{evidence.sites.length} priority census tracts</h4>
      <p className="text-xs text-slate-400">
        {isMock ? 'Simulated tool evidence' : 'Returned tool evidence'} · {evidence.family} model family
      </p>
    </header>
    <div className="grid gap-3 sm:grid-cols-2">
      {evidence.sites.map(site => (
        <article key={site.tractId} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="flex items-center justify-between gap-2">
            <h5 className="font-semibold text-slate-100">#{site.rank} · {site.tractId}</h5>
            <span className="font-mono text-amber-300">
              {site.offsetF > 0 ? '+' : ''}{site.offsetF.toFixed(2)}°F
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Predicted offset vs. campaign city average</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><dt className="text-slate-400">Population</dt><dd>{site.population?.toLocaleString('en-US') ?? 'Unavailable'}</dd></div>
            <div><dt className="text-slate-400">Poverty rate</dt><dd>{site.povertyPct === undefined ? 'Unavailable' : `${site.povertyPct.toFixed(1)}%`}</dd></div>
            <div><dt className="text-slate-400">Car-free households</dt><dd>{site.noVehiclePct === undefined ? 'Unavailable' : `${site.noVehiclePct.toFixed(1)}%`}</dd></div>
          </dl>
          <p className="mt-3 break-words font-mono text-[11px] text-slate-400" aria-label="Site coordinates">
            {site.latitude}, {site.longitude}
          </p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.latitude},${site.longitude}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-sky-300 underline underline-offset-2 focus-visible:outline focus-visible:outline-2"
            aria-label={`View tract ${site.tractId} coordinates on Google Maps (opens a new tab)`}
          >
            <MapPin className="h-3 w-3" aria-hidden="true" /> Open in Google Maps ↗
          </a>
        </article>
      ))}
    </div>
    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-100">
      Screening candidates, not verified facilities. Campaign offsets are not a current forecast.
      Facility availability, capacity and walking routes still need validation.
      Socioeconomic model associations do not establish physical causes of heat.
    </p>
    <button
      type="button" disabled={disabled}
      onClick={() => onAudit(
        `Audit climate equity for these exact recommended census tracts: ${evidence.sites.map(site => site.tractId).join(', ')}. Use the registered equity audit tool. Report its actual outcome or missing evidence; do not generate a new ranking.`
      )}
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
    >
      <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Audit these {evidence.sites.length} tracts
    </button>
    {evidence.model && (
      <details className="text-[11px] text-slate-400">
        <summary className="cursor-pointer">Model provenance</summary>
        <p className="mt-1 break-all font-mono">{evidence.model}</p>
      </details>
    )}
  </section>
);
