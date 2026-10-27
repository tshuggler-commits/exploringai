import { CensusTract, TreeCanopyMetrics, DepartmentBudget, GreeningProjectAllocation } from '../types';

export const CITYWIDE_CANOPY_TARGET_PCT = 50.0;
export const COHORT_MEDIAN_CANOPY_PCT = 37.16;
export const CRITICAL_CANOPY_THRESHOLD_PCT = 20.0;
export const WATERSHED_POP_DENSITY_THRESHOLD = 5141.4;
export const RESILIENCE_SVI_THRESHOLD = 0.50;
export const PROJECT_GRANT_AMOUNT = 1500;

export const INITIAL_BUDGETS: Record<'parks' | 'watershed' | 'resilience', number> = {
  parks: 40000,
  watershed: 50000,
  resilience: 30000,
};

/**
 * Returns default initial budgets with eligibility rules and caps.
 */
export function getInitialDepartmentBudgets(): Record<'parks' | 'watershed' | 'resilience', DepartmentBudget> {
  return {
    parks: {
      id: 'parks',
      name: 'Office of Parks',
      totalCap: INITIAL_BUDGETS.parks,
      allocated: 0,
      remaining: INITIAL_BUDGETS.parks,
      eligibilityCriterion: 'Tree Canopy < 37.16% (Cohort Median Deficit)',
    },
    watershed: {
      id: 'watershed',
      name: 'Dept of Watershed Management',
      totalCap: INITIAL_BUDGETS.watershed,
      allocated: 0,
      remaining: INITIAL_BUDGETS.watershed,
      eligibilityCriterion: 'Population Density > 5,141.4 / sq mi (Runoff / Impervious Proxy)',
    },
    resilience: {
      id: 'resilience',
      name: 'Office of Resilience',
      totalCap: INITIAL_BUDGETS.resilience,
      allocated: 0,
      remaining: INITIAL_BUDGETS.resilience,
      eligibilityCriterion: 'CDC SVI > 0.50 (Vulnerable Community Equity)',
    },
  };
}

/**
 * Calculates tree canopy metrics and multi-departmental co-funding eligibility for a tract.
 */
export function calculateTractCanopyMetrics(tract: CensusTract): TreeCanopyMetrics {
  const canopy = Number(tract.treeCanopyPct ?? 35.0);
  const targetGapPct = Math.max(0, Number((CITYWIDE_CANOPY_TARGET_PCT - canopy).toFixed(1)));

  // Derive realistic Right-Of-Way (ROW) planting area (m²) and marginal cost if not already specified
  const plantableRowSqm = tract.plantableRowSqm ?? Math.round((tract.housingUnits || 1200) * 14.2);
  const marginalPlantingCost =
    tract.marginalPlantingCost ?? Math.round(450 + Math.min(600, (tract.walkScore || 65) * 6.5));

  const isParksEligible =
    tract.isParksEligible !== undefined
      ? tract.isParksEligible
      : canopy < COHORT_MEDIAN_CANOPY_PCT;

  const popDensity =
    tract.popDensity ??
    (tract.totalPop ? Math.round(tract.totalPop * 2.25) : 5200);

  const isWatershedEligible =
    tract.isWatershedEligible !== undefined
      ? tract.isWatershedEligible
      : popDensity > WATERSHED_POP_DENSITY_THRESHOLD;

  const isResilienceEligible =
    tract.isResilienceEligible !== undefined
      ? tract.isResilienceEligible
      : (tract.sviScore ?? 0) > RESILIENCE_SVI_THRESHOLD;

  return {
    treeCanopyPct: canopy,
    targetGapPct,
    plantableRowSqm,
    marginalPlantingCost,
    isParksEligible,
    isWatershedEligible,
    isResilienceEligible,
  };
}

/**
 * Calculates equal cost split across all eligible municipal departments for a $1,500 grant.
 */
export function calculateDepartmentSplit(metrics: TreeCanopyMetrics): {
  eligibleDepts: Array<'parks' | 'watershed' | 'resilience'>;
  splitAmount: number;
  contributions: {
    parks: number;
    watershed: number;
    resilience: number;
  };
} {
  const eligibleDepts: Array<'parks' | 'watershed' | 'resilience'> = [];
  if (metrics.isParksEligible) eligibleDepts.push('parks');
  if (metrics.isWatershedEligible) eligibleDepts.push('watershed');
  if (metrics.isResilienceEligible) eligibleDepts.push('resilience');

  if (eligibleDepts.length === 0) {
    return {
      eligibleDepts: [],
      splitAmount: 0,
      contributions: { parks: 0, watershed: 0, resilience: 0 },
    };
  }

  const splitAmount = Math.round(PROJECT_GRANT_AMOUNT / eligibleDepts.length);
  return {
    eligibleDepts,
    splitAmount,
    contributions: {
      parks: eligibleDepts.includes('parks') ? splitAmount : 0,
      watershed: eligibleDepts.includes('watershed') ? splitAmount : 0,
      resilience: eligibleDepts.includes('resilience') ? splitAmount : 0,
    },
  };
}

/**
 * Calculates dynamic budget drawdown across all 3 departments from project allocations.
 */
export function calculateBudgetDrawdown(allocations: GreeningProjectAllocation[]): {
  budgets: Record<'parks' | 'watershed' | 'resilience', DepartmentBudget>;
  totalCap: number;
  totalAllocated: number;
  totalRemaining: number;
} {
  const budgets = getInitialDepartmentBudgets();

  let allocatedParks = 0;
  let allocatedWatershed = 0;
  let allocatedResilience = 0;

  for (const item of allocations) {
    allocatedParks += item.contributions.parks || 0;
    allocatedWatershed += item.contributions.watershed || 0;
    allocatedResilience += item.contributions.resilience || 0;
  }

  budgets.parks.allocated = allocatedParks;
  budgets.parks.remaining = Math.max(0, budgets.parks.totalCap - allocatedParks);

  budgets.watershed.allocated = allocatedWatershed;
  budgets.watershed.remaining = Math.max(0, budgets.watershed.totalCap - allocatedWatershed);

  budgets.resilience.allocated = allocatedResilience;
  budgets.resilience.remaining = Math.max(0, budgets.resilience.totalCap - allocatedResilience);

  const totalCap = budgets.parks.totalCap + budgets.watershed.totalCap + budgets.resilience.totalCap;
  const totalAllocated = allocatedParks + allocatedWatershed + allocatedResilience;
  const totalRemaining = totalCap - totalAllocated;

  return {
    budgets,
    totalCap,
    totalAllocated,
    totalRemaining,
  };
}

/**
 * Identifies if a tract is a critical bivariate hotspot (high microclimate heat + severe canopy deficit).
 */
export function isBivariateHotspot(tract: CensusTract): boolean {
  const offset = Number(tract.predictedOffsetF ?? 0);
  const canopy = Number(tract.treeCanopyPct ?? 35.0);
  return offset >= 3.5 && canopy < 30.0;
}
