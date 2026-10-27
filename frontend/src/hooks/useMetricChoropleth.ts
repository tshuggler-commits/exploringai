import { useState, useMemo, useCallback } from 'react';
import { CensusTract } from '../types';

export type MetricLayerType =
  | 'heat'
  | 'integratedRisk'
  | 'canopy'
  | 'canopyDeficit'
  | 'svi'
  | 'poverty'
  | 'noVehicle'
  | 'seniors';

export type MetricLayer = MetricLayerType;

export interface LegendItem {
  color: string;
  label: string;
}

export interface LegendConfig {
  title: string;
  items: LegendItem[];
}

export interface MetricValue {
  formatted: string;
  raw: number;
}

export interface MetricOption {
  id: MetricLayerType;
  label: string;
  unit: string;
  description: string;
  format?: (raw: number, tract: CensusTract) => string;
}

export type MetricConfig = MetricOption;

export const METRIC_CONFIGS: Record<MetricLayerType, MetricConfig> = {
  heat: {
    id: 'heat',
    label: 'Microclimate Offset',
    unit: '°F',
    description: 'Predicted ambient temperature differential above regional baseline',
    format: (raw) => (raw > 0 ? `+${raw.toFixed(1)}°F` : `${raw.toFixed(1)}°F`),
  },
  integratedRisk: {
    id: 'integratedRisk',
    label: 'Integrated Risk Score',
    unit: '/100',
    description:
      'Multi-criteria composite: 25% Heat, 25% SVI, 20% Density, 15% Facility Distance, 15% Transit Distance',
    format: (val) => val.toFixed(1),
  },
  canopy: {
    id: 'canopy',
    label: 'Tree Canopy Cover',
    unit: '%',
    description: 'Urban vegetative canopy coverage (50% City Target; 37.2% Cohort Median)',
    format: (raw) => `${raw.toFixed(1)}%`,
  },
  canopyDeficit: {
    id: 'canopyDeficit',
    label: 'Shade / Canopy Deficit',
    unit: '% gap',
    description: 'Deficit from the Atlanta Decade Track 50% tree canopy target: max(0, 50% - canopy)',
    format: (raw) => (raw > 0 ? `-${raw.toFixed(1)}%` : '0.0% (Met)'),
  },
  svi: {
    id: 'svi',
    label: 'Social Vulnerability (SVI)',
    unit: 'score',
    description: 'CDC overall social vulnerability index (0.00 to 1.00)',
    format: (raw) => raw.toFixed(2),
  },
  poverty: {
    id: 'poverty',
    label: 'Poverty Rate',
    unit: '%',
    description: 'Percentage of population living below the federal poverty line',
    format: (raw) => `${raw.toFixed(1)}%`,
  },
  noVehicle: {
    id: 'noVehicle',
    label: 'Zero-Vehicle Households',
    unit: '%',
    description: 'Households without access to a private vehicle (transit dependent)',
    format: (raw) => `${raw.toFixed(1)}%`,
  },
  seniors: {
    id: 'seniors',
    label: 'Senior Vulnerability',
    unit: '% / yrs',
    description: 'Elderly population density or median age indicating thermal sensitivity',
    format: (raw, tract) =>
      tract.seniorsLivingAlonePct !== undefined ? `${raw.toFixed(1)}%` : `${raw.toFixed(1)} yrs`,
  },
};

export const METRIC_OPTIONS: MetricOption[] = Object.values(METRIC_CONFIGS);

/**
 * Calculates hex color code for a census tract according to the specified metric layer.
 */
export function getColor(metric: MetricLayer, tract: CensusTract): string {
  switch (metric) {
    case 'heat': {
      const offset = tract.predictedOffsetF ?? 0;
      if (offset >= 4.0) return '#ef4444'; // Red extreme (+4°F+)
      if (offset >= 2.5) return '#f97316'; // Orange high (+2.5°F to +3.9°F)
      if (offset >= 1.0) return '#eab308'; // Amber medium (+1.0°F to +2.4°F)
      if (offset >= -0.5) return '#38bdf8'; // Sky baseline (-0.5°F to +0.9°F)
      return '#22c55e'; // Green cool (< -0.5°F)
    }

    case 'integratedRisk': {
      const val = tract.integratedRiskScore ?? 0;
      if (val >= 80) return '#e11d48'; // Critical Risk - Rose/Crimson
      if (val >= 60) return '#ea580c'; // High Risk - Orange
      if (val >= 40) return '#d97706'; // Moderate Risk - Amber
      if (val >= 20) return '#0284c7'; // Low-Moderate Risk - Sky
      return '#059669'; // Low Risk - Emerald
    }

    case 'canopy': {
      const canopy = tract.treeCanopyPct ?? 0;
      if (canopy >= 50) return '#15803d'; // Deep forest green / target met
      if (canopy >= 37.16) return '#22c55e'; // Moderate canopy / emerald
      if (canopy >= 20) return '#eab308'; // Below cohort median / light amber-yellow
      return '#ef4444'; // Critical canopy deficit / stark red (< 20%)
    }

    case 'canopyDeficit': {
      const gap =
        tract.targetGapPct !== undefined
          ? tract.targetGapPct
          : Math.max(0, 50 - (tract.treeCanopyPct ?? 0));
      if (gap >= 30) return '#b91c1c'; // Critical deficit ≥ 30%
      if (gap >= 20) return '#ea580c'; // High deficit 20–29%
      if (gap >= 10) return '#eab308'; // Moderate deficit 10–19%
      if (gap > 0) return '#84cc16'; // Low deficit 1–9%
      return '#10b981'; // 50% Target Met
    }

    case 'svi': {
      const svi = tract.sviScore ?? 0;
      if (svi >= 0.80) return '#b91c1c'; // Dark red extreme vulnerability (≥ 0.80)
      if (svi >= 0.60) return '#ef4444'; // Red high (0.60–0.79)
      if (svi >= 0.40) return '#f97316'; // Orange moderate (0.40–0.59)
      if (svi >= 0.20) return '#38bdf8'; // Sky blue low-moderate (0.20–0.39)
      return '#10b981'; // Emerald low (< 0.20)
    }

    case 'poverty': {
      const poverty = tract.povertyRatePct ?? 0;
      if (poverty >= 40) return '#b91c1c'; // Critical poverty (≥ 40%)
      if (poverty >= 30) return '#ef4444'; // High poverty (30–39%)
      if (poverty >= 20) return '#f97316'; // Elevated poverty (20–29%)
      if (poverty >= 10) return '#eab308'; // Moderate poverty (10–19%)
      return '#10b981'; // Low poverty (< 10%)
    }

    case 'noVehicle': {
      const noCar = tract.noVehicleRatePct ?? 0;
      if (noCar >= 40) return '#7c3aed'; // Deep purple / transit desert (≥ 40%)
      if (noCar >= 30) return '#9333ea'; // Purple (30–39%)
      if (noCar >= 20) return '#c084fc'; // Light purple (20–29%)
      if (noCar >= 10) return '#38bdf8'; // Sky blue (10–19%)
      return '#94a3b8'; // Slate / high vehicle access (< 10%)
    }

    case 'seniors': {
      if (tract.seniorsLivingAlonePct !== undefined) {
        const seniors = tract.seniorsLivingAlonePct;
        if (seniors >= 25) return '#9f1239'; // Highest risk
        if (seniors >= 18) return '#e11d48'; // High
        if (seniors >= 12) return '#f43f5e'; // Moderate
        if (seniors >= 6) return '#38bdf8'; // Low-moderate
        return '#94a3b8'; // Low
      }

      const age = tract.medianAge ?? 0;
      if (age >= 45) return '#9f1239'; // High median age / senior risk
      if (age >= 40) return '#e11d48';
      if (age >= 35) return '#f43f5e';
      if (age >= 30) return '#38bdf8';
      return '#94a3b8';
    }

    default:
      return '#38bdf8';
  }
}

/**
 * Extracts and formats the numeric metric value from a census tract.
 */
export function getMetricValue(metric: MetricLayer, tract: CensusTract): MetricValue {
  switch (metric) {
    case 'heat': {
      const raw = tract.predictedOffsetF ?? 0;
      const formatted = raw > 0 ? `+${raw.toFixed(1)}°F` : `${raw.toFixed(1)}°F`;
      return { raw, formatted };
    }

    case 'integratedRisk': {
      const raw = tract.integratedRiskScore ?? 0;
      const formatted = raw.toFixed(1);
      return { raw, formatted };
    }

    case 'canopy': {
      const raw = tract.treeCanopyPct ?? 0;
      const formatted = `${raw.toFixed(1)}%`;
      return { raw, formatted };
    }

    case 'canopyDeficit': {
      const gap =
        tract.targetGapPct !== undefined
          ? tract.targetGapPct
          : Math.max(0, +(50 - (tract.treeCanopyPct ?? 0)).toFixed(1));
      const formatted = gap > 0 ? `-${gap.toFixed(1)}%` : 'Target Met (50%)';
      return { raw: gap, formatted };
    }

    case 'svi': {
      const raw = tract.sviScore ?? 0;
      const formatted = tract.sviScore !== undefined ? raw.toFixed(2) : 'N/A';
      return { raw, formatted };
    }

    case 'poverty': {
      const raw = tract.povertyRatePct ?? 0;
      const formatted = `${raw.toFixed(1)}%`;
      return { raw, formatted };
    }

    case 'noVehicle': {
      const raw = tract.noVehicleRatePct ?? 0;
      const formatted = `${raw.toFixed(1)}%`;
      return { raw, formatted };
    }

    case 'seniors': {
      if (tract.seniorsLivingAlonePct !== undefined) {
        const raw = tract.seniorsLivingAlonePct;
        const formatted = `${raw.toFixed(1)}%`;
        return { raw, formatted };
      }
      const raw = tract.medianAge ?? 0;
      const formatted = `${raw.toFixed(1)} yrs`;
      return { raw, formatted };
    }

    default:
      return { raw: 0, formatted: '0' };
  }
}

/**
 * Returns the title and color legend key items for a given metric layer.
 */
export function getLegendConfig(metric: MetricLayer): LegendConfig {
  switch (metric) {
    case 'heat':
      return {
        title: 'Microclimate Heat Offset (°F)',
        items: [
          { color: '#ef4444', label: '+4.0°F+ (Extreme Heat)' },
          { color: '#f97316', label: '+2.5°F to +3.9°F (High)' },
          { color: '#eab308', label: '+1.0°F to +2.4°F (Elevated)' },
          { color: '#38bdf8', label: '-0.5°F to +0.9°F (Baseline)' },
          { color: '#22c55e', label: '< -0.5°F (Cool / Vegetated)' },
        ],
      };

    case 'integratedRisk':
      return {
        title: 'Integrated Risk Score',
        items: [
          { color: '#e11d48', label: '≥ 80 (Critical Risk)' },
          { color: '#ea580c', label: '60 – 79 (High Risk)' },
          { color: '#d97706', label: '40 – 59 (Moderate Risk)' },
          { color: '#0284c7', label: '20 – 39 (Low-Moderate Risk)' },
          { color: '#059669', label: '< 20 (Low Risk)' },
        ],
      };

    case 'canopy':
      return {
        title: 'Tree Canopy Cover (%)',
        items: [
          { color: '#15803d', label: '≥ 50% (50% City Target)' },
          { color: '#22c55e', label: '37.2% – 49.9% (Above Median)' },
          { color: '#eab308', label: '20.0% – 37.1% (Below Median)' },
          { color: '#ef4444', label: '< 20.0% (Critical Shelter Deficit)' },
        ],
      };

    case 'canopyDeficit':
      return {
        title: 'Shade / Canopy Deficit (% Gap)',
        items: [
          { color: '#b91c1c', label: '≥ 30% Gap (Critical)' },
          { color: '#ea580c', label: '20% – 29% Gap (High)' },
          { color: '#eab308', label: '10% – 19% Gap (Moderate)' },
          { color: '#84cc16', label: '1% – 9% Gap (Low)' },
          { color: '#10b981', label: '0% Gap (50% Target Met)' },
        ],
      };

    case 'svi':
      return {
        title: 'CDC Social Vulnerability Index (SVI)',
        items: [
          { color: '#b91c1c', label: '≥ 0.80 (Very High Vulnerability)' },
          { color: '#ef4444', label: '0.60 – 0.79 (High Vulnerability)' },
          { color: '#f97316', label: '0.40 – 0.59 (Moderate Vulnerability)' },
          { color: '#38bdf8', label: '0.20 – 0.39 (Low Vulnerability)' },
          { color: '#10b981', label: '< 0.20 (Very Low Vulnerability)' },
        ],
      };

    case 'poverty':
      return {
        title: 'Poverty Rate (%)',
        items: [
          { color: '#b91c1c', label: '≥ 40% (Severe Poverty)' },
          { color: '#ef4444', label: '30% – 39% (High Poverty)' },
          { color: '#f97316', label: '20% – 29% (Elevated Poverty)' },
          { color: '#eab308', label: '10% – 19% (Moderate Poverty)' },
          { color: '#10b981', label: '< 10% (Low Poverty)' },
        ],
      };

    case 'noVehicle':
      return {
        title: 'Zero-Vehicle Households (%)',
        items: [
          { color: '#7c3aed', label: '≥ 40% (Transit Desert)' },
          { color: '#9333ea', label: '30% – 39% (High No-Car)' },
          { color: '#c084fc', label: '20% – 29% (Moderate No-Car)' },
          { color: '#38bdf8', label: '10% – 19% (Low-Moderate)' },
          { color: '#94a3b8', label: '< 10% (High Vehicle Access)' },
        ],
      };

    case 'seniors':
      return {
        title: 'Senior Heat Vulnerability',
        items: [
          { color: '#9f1239', label: '≥ 25% Seniors / Age ≥ 45 (Highest Risk)' },
          { color: '#e11d48', label: '18% – 24% / Age 40–44 (High)' },
          { color: '#f43f5e', label: '12% – 17% / Age 35–39 (Moderate)' },
          { color: '#38bdf8', label: '6% – 11% / Age 30–34 (Low-Moderate)' },
          { color: '#94a3b8', label: '< 6% / Age < 30 (Lowest Risk)' },
        ],
      };

    default:
      return {
        title: 'Metric Choropleth',
        items: [],
      };
  }
}

export interface UseMetricChoroplethOptions {
  initialMetric?: MetricLayer;
}

export interface UseMetricChoroplethReturn {
  activeMetric: MetricLayer;
  setActiveMetric: (metric: MetricLayer) => void;
  setMetric: (metric: MetricLayer) => void;
  getColor: (metricOrTract: MetricLayer | CensusTract, maybeTract?: CensusTract) => string;
  getMetricValue: (metricOrTract: MetricLayer | CensusTract, maybeTract?: CensusTract) => MetricValue;
  getLegendConfig: (metric?: MetricLayer) => LegendConfig;
  legendConfig: LegendConfig;
  metricOptions: MetricOption[];
  metricConfigs: Record<MetricLayer, MetricConfig>;
}

/**
 * Custom React hook for controlling active metric layers on choropleth visualizations.
 */
export function useMetricChoropleth(
  options?: UseMetricChoroplethOptions
): UseMetricChoroplethReturn {
  const [activeMetric, setActiveMetric] = useState<MetricLayer>(
    options?.initialMetric ?? 'heat'
  );

  // Hook-level getColor supporting both (metric, tract) and (tract) signatures
  const resolveColor = useCallback(
    (metricOrTract: MetricLayer | CensusTract, maybeTract?: CensusTract): string => {
      if (typeof metricOrTract === 'string') {
        return getColor(metricOrTract, maybeTract!);
      }
      return getColor(activeMetric, metricOrTract);
    },
    [activeMetric]
  );

  // Hook-level getMetricValue supporting both (metric, tract) and (tract) signatures
  const resolveMetricValue = useCallback(
    (metricOrTract: MetricLayer | CensusTract, maybeTract?: CensusTract): MetricValue => {
      if (typeof metricOrTract === 'string') {
        return getMetricValue(metricOrTract, maybeTract!);
      }
      return getMetricValue(activeMetric, metricOrTract);
    },
    [activeMetric]
  );

  // Hook-level getLegendConfig defaulting to current active metric
  const resolveLegendConfig = useCallback(
    (metric?: MetricLayer): LegendConfig => {
      return getLegendConfig(metric ?? activeMetric);
    },
    [activeMetric]
  );

  const legendConfig = useMemo(() => {
    return getLegendConfig(activeMetric);
  }, [activeMetric]);

  return {
    activeMetric,
    setActiveMetric,
    setMetric: setActiveMetric,
    getColor: resolveColor,
    getMetricValue: resolveMetricValue,
    getLegendConfig: resolveLegendConfig,
    legendConfig,
    metricOptions: METRIC_OPTIONS,
    metricConfigs: METRIC_CONFIGS,
  };
}

export default useMetricChoropleth;
