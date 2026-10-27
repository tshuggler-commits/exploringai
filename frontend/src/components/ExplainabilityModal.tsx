import React, { useState } from 'react';
import { MOCK_FEATURE_ATTRIBUTIONS } from '../data/mockData';
import { CensusTract } from '../types';
import { 
  X, 
  Sparkles, 
  AlertCircle, 
  Trees, 
  Building2, 
  Car, 
  Compass, 
  Flame, 
  ShieldAlert, 
  Bus, 
  Scale, 
  Lock,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface ExplainabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  tract: CensusTract | null;
}

const FIVE_RISK_FACTORS = [
  {
    id: 'heat',
    name: 'Microclimate Heat Offset',
    subtitle: 'NOAA Heat Watch Traverse Delta (25% Weight)',
    weightPct: 25,
    icon: <Flame className="w-4 h-4 text-rose-400" />,
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description:
      'Direct localized ambient air temperature differential (°F) above regional baseline, captured during NOAA mobile traverse campaigns and predicted by BigQuery ML spatial regression.',
    impact: 'Captures acute physical thermal dome effects on pedestrians and unconditioned structures.',
    mitigation: 'Mobile hydration misting units, cooling shelter buses, and high-albedo surfaces.',
  },
  {
    id: 'svi',
    name: 'CDC Social Vulnerability Index',
    subtitle: 'SVI Race-Neutral Socioeconomic Proxies (25% Weight)',
    weightPct: 25,
    icon: <ShieldAlert className="w-4 h-4 text-purple-400" />,
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description:
      'CDC/ATSDR composite metric combining poverty rates, elderly living alone, disability prevalence, and income deprivation into a standardized vulnerability index (0.00–1.00).',
    impact: 'Reflects severe household inability to afford continuous indoor air conditioning utility bills.',
    mitigation: 'Paramedic triage wellness vans, utility cooling bill-credit subsidies, and community hubs.',
  },
  {
    id: 'density_canopy',
    name: 'Population Density & Tree Canopy Deficit',
    subtitle: 'Asphalt Sinks vs. Vegetative Respite (20% Weight)',
    weightPct: 20,
    icon: <Trees className="w-4 h-4 text-emerald-400" />,
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description:
      'High residential density contrasted against urban vegetative canopy coverage deficit. Unshaded parking lots and asphalt corridors absorb solar radiation rapidly.',
    impact: 'Exposes high concentrations of residents without pedestrian tree shade buffers.',
    mitigation: 'Targeted street tree plantings, shade sail canopies, and park green buffers.',
  },
  {
    id: 'facility',
    name: 'Proximity to Public Facility',
    subtitle: 'Pedestrian Walk-Shed Deficit (15% Weight)',
    weightPct: 15,
    icon: <Building2 className="w-4 h-4 text-sky-400" />,
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    description:
      'Euclidean and pedestrian network distance (meters) to the nearest municipal recreation center, public library, or community center equipped for emergency cooling.',
    impact: 'Identifies cooling facility deserts where residents cannot safely reach an air-conditioned haven on foot within 10 minutes.',
    mitigation: 'Activating candidate cooling sites at community facilities and dispatching mobile hydration assets.',
  },
  {
    id: 'transit',
    name: 'Proximity to Transit Station',
    subtitle: 'MARTA Connectivity & Transit Dependence (15% Weight)',
    weightPct: 15,
    icon: <Bus className="w-4 h-4 text-indigo-400" />,
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description:
      'Distance to nearest MARTA rail or bus transfer hub, paired with tract zero-vehicle household deprivation rates.',
    impact: 'Highlights transit-dependent residents forced to wait outdoors at unshaded stops without personal vehicle access.',
    mitigation: 'Staging 68°F air-conditioned MARTA shelter buses directly at high-ridership transfer points.',
  },
];

export const ExplainabilityModal: React.FC<ExplainabilityModalProps> = ({
  isOpen,
  onClose,
  tract,
}) => {
  const [showTechnicalNotes, setShowTechnicalNotes] = useState<boolean>(true);

  const { modalRef, handleBackdropClick } = useModalDismiss({
    isOpen: isOpen && !!tract,
    onClose,
  });

  if (!isOpen || !tract) return null;

  const attributions = MOCK_FEATURE_ATTRIBUTIONS;

  const getFriendlyFeatureInfo = (feature: string) => {
    const f = feature.toLowerCase();
    if (f.includes('tree') || f.includes('canopy') || f.includes('pavement')) {
      return {
        icon: <Trees className="w-4 h-4 text-emerald-400" />,
        friendlyName: 'Tree Canopy Deficit & Pavement Fraction',
        plainEnglish:
          'Unshaded asphalt roads and parking lots absorb solar radiation rapidly, radiating heat back into pedestrian walkways.',
        recommendation: 'Target for rapid tree plantings, shade sails, and high-albedo cool pavements.',
      };
    }
    if (f.includes('building') || f.includes('vintage') || f.includes('construction')) {
      return {
        icon: <Building2 className="w-4 h-4 text-amber-400" />,
        friendlyName: 'Building Vintage & Thermal Mass (Pre-1970)',
        plainEnglish:
          'Older masonry and dark, uninsulated commercial roofs retain heat throughout the day and re-radiate it overnight.',
        recommendation: 'Cool-roof retrofit incentives and indoor AC assistance for residents.',
      };
    }
    if (f.includes('disinvestment') || f.includes('density') || f.includes('impervious')) {
      return {
        icon: <Car className="w-4 h-4 text-rose-400" />,
        friendlyName: 'Impervious Surface & Green Buffer Deficit',
        plainEnglish:
          'High concentration of paved surfaces without vegetative pocket parks creates a localized heat dome.',
        recommendation: 'Pocket parks, bioswales, and mobile hydration misting stations.',
      };
    }
    return {
      icon: <Compass className="w-4 h-4 text-sky-400" />,
      friendlyName: 'Basin Topography & Air Stagnation',
      plainEnglish:
        'Local elevation basins trap warm air and restrict natural convective breeze cooling during peak afternoon hours.',
      recommendation: 'Strategic placement of emergency cooling shelter shuttles and hydration units.',
    };
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explainability-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-scale-in"
      >
        {/* Pinned Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 id="explainability-modal-title" className="text-base sm:text-lg font-bold text-white leading-tight">
                AI Explainability & Multi-Criteria Risk Scoring
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Decomposing microclimate thermal offset drivers and multi-criteria risk weighting for Atlanta census tracts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close explainability view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explainability Body */}
        <div className="space-y-5 p-6 py-4 flex-1 min-h-0 overflow-y-auto modal-scroll-container">
          {/* Tract Summary Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white block">{tract.neighborhood}</span>
              <span className="text-[11px] font-mono text-slate-400">Census Tract GEOID: {tract.geoId}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Offset:</span>
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {tract.predictedOffsetF > 0 ? `+${tract.predictedOffsetF}°F` : `${tract.predictedOffsetF}°F`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Integrated Risk:</span>
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {tract.integratedRiskScore !== undefined ? `${tract.integratedRiskScore.toFixed(1)}/100` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: The 5 BQML Multi-Criteria Integrated Risk Scoring Factors */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-bold text-white tracking-wide">
                The 5 BQML Multi-Criteria Integrated Risk Scoring Factors
              </h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              To prioritize equitable heat mitigation without black-box opacity, the system fuses physical microclimate predictions with census vulnerability and spatial accessibility metrics:
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {FIVE_RISK_FACTORS.map((factor) => (
                <div
                  key={factor.id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {factor.icon}
                      <span className="text-xs font-bold text-slate-100">{factor.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${factor.badgeColor}`}>
                      {factor.subtitle}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{factor.description}</p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900 gap-1">
                    <span>
                      <strong className="text-slate-300">Impact:</strong> {factor.impact}
                    </span>
                    <span className="text-emerald-400 font-medium shrink-0">
                      <strong>Mitigation:</strong> {factor.mitigation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Spatial Holdout & Ethical Race-Neutral Proxy Notes */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scale className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Model Integrity, Spatial Validation & Ethical Compliance
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowTechnicalNotes(!showTechnicalNotes)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                {showTechnicalNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showTechnicalNotes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                {/* Spatial Grid Holdouts Note */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-sky-400 font-semibold">
                    <Lock className="w-3.5 h-3.5" />
                    <span>0.02° Spatial Cell Holdouts (`FARM_FINGERPRINT`)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Standard random train/test splits cause severe spatial autocorrelation leakage between neighboring tracts. To ensure genuine out-of-sample generalization, BigQuery ML partitions tracts into 0.02° latitude/longitude spatial blocks hashed via <code className="text-amber-400 font-mono">FARM_FINGERPRINT()</code>, completely reserving contiguous geographical zones for blind evaluation.
                  </p>
                </div>

                {/* Race-Neutral Proxy Compliance Note */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                    <Scale className="w-3.5 h-3.5" />
                    <span>Ethical Race-Neutral Proxy Compliance</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    In strict compliance with Title VI of the Civil Rights Act and EPA environmental justice standards, the model excludes racial or protected demographic variables. Instead, it measures objective, race-neutral physical risk proxies: income deprivation, pre-1970 uninsulated housing vintage, zero-vehicle transit dependency, and clinical age vulnerability.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Shapley Feature Attribution (SHAP) Decompositions */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Localized Microclimate SHAP Feature Attribution
              </h4>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              BigQuery ML calculates exact Shapley Additive Explanations (SHAP) decomposing the tract's microclimate heat into addressable physical urban features:
            </p>

            <div className="space-y-2.5">
              {attributions.map((attr, idx) => {
                const info = getFriendlyFeatureInfo(attr.feature);
                const percentage = Math.min(100, (attr.attributionF / 2.0) * 100);

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {info.icon}
                        <span className="text-xs font-bold text-slate-100">{info.friendlyName}</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                        +{attr.attributionF.toFixed(2)}°F impact
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{info.plainEnglish}</p>

                    {/* Relative contribution bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Baseline Feature: <strong className="text-slate-300 font-mono">{attr.feature}</strong></span>
                      <span className="text-emerald-400 font-medium">Mitigation: {info.recommendation}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pinned Footer */}
        <div className="p-4 border-t border-slate-800 shrink-0 flex items-center justify-between bg-slate-900/95">
          <span className="text-xs text-slate-400">
            Powered by Vertex AI AutoML & BigQuery ML Explainability
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Close Attribution View
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExplainabilityModal;
