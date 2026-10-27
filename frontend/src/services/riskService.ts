import { CoolingCenterRanking, FormulaWeights, RankingScenarioPreset } from '../types';

/**
 * Standard Multi-Criteria Weight Presets for Cooling Center Prioritization
 */
export const EQUALIZED_BASELINE: RankingScenarioPreset = {
  id: 'equalized_baseline',
  name: 'Equalized Baseline (Balanced)',
  description:
    'Balanced multi-factor evaluation weighting thermal offset, CDC social vulnerability, population density, and access deficits.',
  weights: {
    heat: 0.25,
    svi: 0.25,
    density: 0.20,
    facility: 0.15,
    transit: 0.15,
  },
};

export const EMERGENCY_HEATWAVE: RankingScenarioPreset = {
  id: 'emergency_heatwave',
  name: 'Emergency Heatwave (Severe Heat Spike)',
  description:
    'Prioritizes extreme microclimate thermal offset (40%) and social vulnerability for urgent emergency response during acute heatwaves.',
  weights: {
    heat: 0.40,
    svi: 0.25,
    density: 0.15,
    facility: 0.10,
    transit: 0.10,
  },
};

export const LONG_TERM_INFRASTRUCTURE: RankingScenarioPreset = {
  id: 'long_term_infrastructure',
  name: 'Long-Term Infrastructure (Capital Siting)',
  description:
    'Prioritizes permanent cooling facility deserts (25%) and transit connectivity gaps (20%) to guide multi-year capital improvements.',
  weights: {
    heat: 0.15,
    svi: 0.25,
    density: 0.15,
    facility: 0.25,
    transit: 0.20,
  },
};

export const RANKING_PRESETS: RankingScenarioPreset[] = [
  EQUALIZED_BASELINE,
  EMERGENCY_HEATWAVE,
  LONG_TERM_INFRASTRUCTURE,
];

/**
 * Normalizes input metrics to [0, 1] bounds and computes the formula component breakdown.
 */
export function calculateFormulaBreakdown(
  metrics: {
    heatOffsetF: number;
    sviScore: number;
    popDensity?: number;
    distToFacilityMeters?: number;
    distToTransitMeters?: number;
  },
  weights: FormulaWeights = EQUALIZED_BASELINE.weights
): {
  heat: number;
  svi: number;
  density: number;
  facility: number;
  transit: number;
  total: number;
} {
  const sumW =
    (weights.heat + weights.svi + weights.density + weights.facility + weights.transit) || 1.0;
  const wHeat = weights.heat / sumW;
  const wSvi = weights.svi / sumW;
  const wDensity = weights.density / sumW;
  const wFacility = weights.facility / sumW;
  const wTransit = weights.transit / sumW;

  // Normalizations:
  // Heat offset: 0.0 to 5.0 °F typical range
  const nHeat = Math.min(1, Math.max(0, metrics.heatOffsetF / 5.0));
  // CDC SVI: 0.00 to 1.00
  const nSvi = Math.min(1, Math.max(0, metrics.sviScore));
  // Population density: 0 to 9000 people/sq mi
  const nDensity = Math.min(1, Math.max(0, (metrics.popDensity ?? 5500) / 9000));
  // Distance to nearest existing facility: 0 to 2500m (higher distance = greater deficit)
  const nFacility = Math.min(1, Math.max(0, (metrics.distToFacilityMeters ?? 1800) / 2500));
  // Distance to nearest MARTA transit: 0 to 1500m (higher distance = greater transit desert)
  const nTransit = Math.min(1, Math.max(0, (metrics.distToTransitMeters ?? 700) / 1500));

  const heat = Number((wHeat * nHeat * 100).toFixed(1));
  const svi = Number((wSvi * nSvi * 100).toFixed(1));
  const density = Number((wDensity * nDensity * 100).toFixed(1));
  const facility = Number((wFacility * nFacility * 100).toFixed(1));
  const transit = Number((wTransit * nTransit * 100).toFixed(1));
  const total = Number((heat + svi + density + facility + transit).toFixed(2));

  return { heat, svi, density, facility, transit, total };
}

/**
 * Calculates the multi-criteria Integrated Risk Score (0-100 scale).
 *
 * Formula:
 * Score = [ w_heat * N(heat) + w_svi * N(svi) + w_density * N(density)
 *          + w_facility * N(distToFacility) + w_transit * N(distToTransit) ] * 100
 */
export function calculateIntegratedRiskScore(
  metrics: {
    heatOffsetF: number;
    sviScore: number;
    popDensity?: number;
    distToFacilityMeters?: number;
    distToTransitMeters?: number;
  },
  weights: FormulaWeights = EQUALIZED_BASELINE.weights,
  baselineF: number = 92.0
): number {
  void baselineF; // Reference baseline acknowledged
  const breakdown = calculateFormulaBreakdown(metrics, weights);
  return breakdown.total;
}

/**
 * Recalculates risk scores and rankings across all cooling center candidates,
 * updates localized temperatures, sorts descending by integrated risk score,
 * and reassigns rank 1..N.
 */
export function recalculateRankings(
  rankings: CoolingCenterRanking[],
  weights: FormulaWeights = EQUALIZED_BASELINE.weights,
  baselineF: number = 92.0
): CoolingCenterRanking[] {
  const updated = rankings.map((candidate) => {
    const heatOffset = candidate.predictedOffsetF;
    const localizedTempF = Number((baselineF + heatOffset).toFixed(1));
    const svi = candidate.sviScore !== undefined ? candidate.sviScore : 0.80;
    const popDensity = candidate.popDensity ?? 5500;
    const distToFacilityMeters = candidate.distToFacilityMeters ?? 1800;
    const distToTransitMeters = candidate.distToTransitMeters ?? 700;

    const breakdown = calculateFormulaBreakdown(
      {
        heatOffsetF: heatOffset,
        sviScore: svi,
        popDensity,
        distToFacilityMeters,
        distToTransitMeters,
      },
      weights
    );

    const integratedRiskScore = breakdown.total;

    return {
      ...candidate,
      localizedTempF,
      sviScore: svi,
      popDensity,
      distToFacilityMeters,
      distToTransitMeters,
      integratedRiskScore,
      compositeScore: integratedRiskScore,
      formulaBreakdown: {
        heat: breakdown.heat,
        svi: breakdown.svi,
        density: breakdown.density,
        facility: breakdown.facility,
        transit: breakdown.transit,
      },
    };
  });

  // Sort descending by integratedRiskScore
  updated.sort((a, b) => (b.integratedRiskScore ?? 0) - (a.integratedRiskScore ?? 0));

  // Re-rank 1..N
  return updated.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}
