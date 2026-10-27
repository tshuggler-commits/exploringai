export interface TreeCanopyMetrics {
  treeCanopyPct: number;
  targetGapPct: number; // max(0, 50 - treeCanopyPct)
  plantableRowSqm?: number;
  marginalPlantingCost?: number;
  isParksEligible?: boolean;     // canopy < 37.16%
  isWatershedEligible?: boolean; // popDensity > 5141.4 (or high runoff proxy)
  isResilienceEligible?: boolean;// sviScore > 0.50
}

export interface CensusTract {
  geoId: string;
  name: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  totalPop: number;
  povertyRatePct: number;
  noVehicleRatePct: number;
  medianIncome: number;
  medianAge: number;
  medianYearBuilt: number;
  housingUnits: number;
  predictedOffsetF: number;
  treeCanopyPct: number;
  walkScore: number;
  sviScore?: number;
  integratedRiskScore?: number;
  hasCoolingCenter?: boolean;
  coolingCenterName?: string;
  coolingCenterType?: 'Library' | 'Recreation Center' | 'Community Center' | 'High School';
  seniorsLivingAlonePct?: number;
  disabilityRatePct?: number;
  wellnessPriority?: boolean;
  treeCanopyMetrics?: TreeCanopyMetrics;
  targetGapPct?: number;
  plantableRowSqm?: number;
  marginalPlantingCost?: number;
  isParksEligible?: boolean;
  isWatershedEligible?: boolean;
  isResilienceEligible?: boolean;
  popDensity?: number;
}

export interface CoolingCenterRanking {
  rank: number;
  tractId: string;
  neighborhood: string;
  name: string;
  latitude: number;
  longitude: number;
  predictedOffsetF: number;
  localizedTempF?: number;
  population: number;
  povertyRatePct: number;
  noVehicleRatePct: number;
  compositeScore: number;
  sitingJustification: string;
  walkAccessMinutes: number;
  integratedRiskScore?: number;
  sviScore?: number;
  popDensity?: number;
  distToFacilityMeters?: number;
  distToTransitMeters?: number;
  treeCanopyPct?: number;
  formulaBreakdown?: {
    heat: number;
    svi: number;
    density: number;
    facility: number;
    transit: number;
  };
}

export interface FormulaWeights {
  heat: number;      // default 0.25 (25%)
  svi: number;       // default 0.25 (25%)
  density: number;   // default 0.20 (20%)
  facility: number;  // default 0.15 (15%)
  transit: number;   // default 0.15 (15%)
}

export interface RankingScenarioPreset {
  id: string;
  name: string;
  description: string;
  weights: FormulaWeights;
}

export interface DepartmentBudget {
  id: 'parks' | 'watershed' | 'resilience';
  name: string;
  totalCap: number; // Parks $40k, Watershed $50k, Resilience $30k
  allocated: number;
  remaining: number;
  eligibilityCriterion: string;
}

export interface GreeningProjectAllocation {
  id: string;
  tractGeoId: string;
  tractName: string;
  neighborhood: string;
  totalCost: number; // $1,500
  contributions: {
    parks: number;
    watershed: number;
    resilience: number;
  };
  eligibleDepartments: Array<'parks' | 'watershed' | 'resilience'>;
  timestamp: string;
}

export interface StationHeatRecord {
  year: number;
  daysExceeding90F: number;
  daysExceeding95F: number;
  daysExceeding100F: number;
  peakTempF: number;
  avgSummerMaxF: number;
}

export interface FeatureAttribution {
  feature: string;
  attributionF: number;
  baselineContribution: string;
  impactDirection: 'increases_heat' | 'reduces_heat';
}

export interface EquityAuditSummary {
  citywidePovertyP75: number;
  citywideNoVehicleP75: number;
  recommendedTractsCount: number;
  povertyAuditPass: boolean;
  transitAuditPass: boolean;
  overallAuditPass: boolean;
  averagePovertyPct: number;
  averageNoVehiclePct: number;
  justificationNotes: string;
}

export interface ToolCallTrace {
  id?: string;
  name: string;
  arguments: Record<string, any>;
  output?: Record<string, any> | string;
}

export interface RankedSiteEvidence {
  rank: number;
  tractId: string;
  latitude: number;
  longitude: number;
  offsetF: number;
  population?: number;
  povertyPct?: number;
  noVehiclePct?: number;
}

export interface RankingEvidence {
  family: 'atlanta' | 'planning';
  model?: string;
  sites: RankedSiteEvidence[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallTrace[];
  model?: string;
  latencyMs?: number;
  source?: 'live' | 'mock';
  isError?: boolean;
}

export type AssetType = 'hydration' | 'wellness' | 'bus';

export interface DispatchedAsset {
  id: string;
  type: AssetType;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  tractId?: string;
  dispatchedAt: string;
  status: 'en-route' | 'on-site';
  protectedPopulation: number;
}

export interface PlannerDecision {
  id: string;
  title: string;
  description: string;
  category: 'Immediate' | 'Mobile Surge' | 'Vulnerability' | 'Transit Desert';
  dueTime: string;
  actionLabel: string;
  actionType: 'draft_council' | 'deploy_hydration' | 'deploy_wellness' | 'stage_bus';
  tractId?: string;
  locationName?: string;
  lat?: number;
  lng?: number;
  impactPopulation: number;
  status: 'pending' | 'executed';
}

export interface HeatAlert {
  id: string;
  title: string;
  zone: string;
  severity: 'warning' | 'advisory' | 'spike';
  description: string;
  recommendation: string;
}
export interface CouncilMemoData {
  memoId: string;
  date: string;
  to: string;
  from: string;
  subject: string;
  executiveSummary: string;
  triggerCondition: {
    peakTempF: number;
    heatIndexF: number;
    advisoryLevel: string;
    expectedDuration: string;
    affectedPopulation: number;
  };
  recommendedSites: Array<{
    rank: number;
    name: string;
    neighborhood: string;
    tractId: string;
    predictedOffsetF: number;
    localizedTempF?: number;
    population: number;
    povertyRatePct: number;
    noVehicleRatePct: number;
    sviScore?: number;
    compositeScore: number;
    walkAccessMinutes: number;
    justification: string;
  }>;
  dispatchedAssets: DispatchedAsset[];
  equityMetrics: {
    averagePovertyPct: number;
    averageNoVehiclePct: number;
    averageSviScore?: number;
    tractsAbovePovertyP75: number;
    tractsAboveTransitP75: number;
    equityAuditPassed: boolean;
  };
  wellnessPrioritization: {
    highPriorityTractCount: number;
    seniorDisabilityFocusSummary: string;
    targetWellnessChecks: number;
  };
  fiscalAndOperationalImpact: {
    projectedDailyCost: number;
    partnerAgencies: string[];
    volunteerDeployments: number;
    shelterCapacity: number;
  };
  canopyMetrics?: {
    avgCanopyPct: number;
    avgCanopyDeficitPct: number;
    tractsBelowCohortMedian: number;
    recommendedPlantingCount: number;
    multiDeptFundAllocated: number;
    multiDeptFundTotal: number;
  };
  actionItems: string[];
  signedBy: string;
}

export type CouncilMemo = CouncilMemoData;

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

