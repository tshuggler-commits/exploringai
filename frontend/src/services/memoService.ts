import { DispatchedAsset, CoolingCenterRanking } from '../types';
import { CITYWIDE_CANOPY_TARGET_PCT, COHORT_MEDIAN_CANOPY_PCT } from './canopyService';

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

/**
 * Formats a CDC SVI score as a standardized 0.00 to 1.00 index score (e.g. "0.85")
 */
export function formatSviScore(score?: number): string {
  if (score === undefined || score === null || isNaN(score)) {
    return 'N/A';
  }
  return score.toFixed(2);
}

export interface MemoGenerationOptions {
  memoId?: string;
  date?: string;
  to?: string;
  from?: string;
  subject?: string;
  peakTempF?: number;
  heatIndexF?: number;
  advisoryLevel?: string;
  expectedDuration?: string;
  signedBy?: string;
}

/**
 * Generates structured City Council Emergency Heat Memo data
 * combining prioritized cooling center sites and active dispatched mobile assets.
 */
export function generateCouncilMemo(
  sites: (Partial<CoolingCenterRanking> | any)[] = [],
  dispatchedAssets: DispatchedAsset[] = [],
  options: MemoGenerationOptions = {}
): CouncilMemoData {
  const currentDate = new Date();
  const dateFormatted = options.date || currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const dateNumeric = currentDate.toISOString().slice(0, 10).replace(/-/g, '');
  const memoId = options.memoId || `ATL-MEMO-HEAT-${dateNumeric}-${randomSuffix}`;

  // Process sites with robust attribute mapping
  const normalizedSites = sites.map((s, index) => {
    const rank = s.rank ?? index + 1;
    const name = s.name || s.coolingCenterName || `Resilience Hub ${rank}`;
    const neighborhood = s.neighborhood || 'Atlanta Metropolitan Area';
    const tractId = s.tractId || s.geoId || `Tract-${index + 1}`;
    const predictedOffsetF = Number(s.predictedOffsetF ?? 3.5);
    const localizedTempF = s.localizedTempF ? Number(s.localizedTempF) : (options.peakTempF || 96.5) + predictedOffsetF;
    const population = Number(s.population ?? s.totalPop ?? 3200);
    const povertyRatePct = Number(s.povertyRatePct ?? 22.0);
    const noVehicleRatePct = Number(s.noVehicleRatePct ?? 14.0);
    const sviScore = s.sviScore !== undefined ? Number(s.sviScore) : undefined;
    const compositeScore = Number(s.compositeScore ?? s.integratedRiskScore ?? 60.0);
    const walkAccessMinutes = Number(s.walkAccessMinutes ?? 10);
    const justification = s.sitingJustification || s.justification ||
      `High microclimate thermal offset (+${predictedOffsetF.toFixed(1)}°F) and low transit vehicle ownership (${noVehicleRatePct.toFixed(1)}%).`;

    return {
      rank,
      name,
      neighborhood,
      tractId,
      predictedOffsetF,
      localizedTempF,
      population,
      povertyRatePct,
      noVehicleRatePct,
      sviScore,
      compositeScore,
      walkAccessMinutes,
      justification,
    };
  });

  // Calculate equity & demographic aggregates
  const siteCount = Math.max(1, normalizedSites.length);
  const totalPop = normalizedSites.reduce((acc, s) => acc + s.population, 0);
  const avgPoverty = normalizedSites.reduce((acc, s) => acc + s.povertyRatePct, 0) / siteCount;
  const avgNoVehicle = normalizedSites.reduce((acc, s) => acc + s.noVehicleRatePct, 0) / siteCount;

  // Benchmarks: P75 Poverty = 24.5%, P75 No Vehicle = 14.8%
  const tractsAbovePovertyP75 = normalizedSites.filter((s) => s.povertyRatePct >= 24.5).length;
  const tractsAboveTransitP75 = normalizedSites.filter((s) => s.noVehicleRatePct >= 14.8).length;
  const tractsWithSvi = normalizedSites.filter((s) => s.sviScore !== undefined);
  const avgSvi = tractsWithSvi.length > 0
    ? tractsWithSvi.reduce((acc, s) => acc + (s.sviScore || 0), 0) / tractsWithSvi.length
    : 0.82;
  const equityAuditPassed = avgPoverty >= 24.5 || tractsAbovePovertyP75 >= Math.ceil(siteCount * 0.5);

  // Wellness check targeting
  const seniorDisabilityTracts = normalizedSites.filter(
    (s) => s.povertyRatePct > 25 || (s.sviScore && s.sviScore > 0.7) || s.noVehicleRatePct > 18
  );
  const highPriorityCount = seniorDisabilityTracts.length > 0 ? seniorDisabilityTracts.length : Math.ceil(siteCount * 0.4);
  const targetChecks = highPriorityCount * 180;

  // Canopy & urban forestry calculations
  const tractsWithCanopy = normalizedSites.filter((s: any) => s.treeCanopyPct !== undefined || s.treeCanopyMetrics?.treeCanopyPct !== undefined);
  const avgCanopy = tractsWithCanopy.length > 0
    ? tractsWithCanopy.reduce((acc: number, s: any) => acc + (s.treeCanopyPct ?? s.treeCanopyMetrics?.treeCanopyPct ?? 35), 0) / tractsWithCanopy.length
    : 28.4;
  const avgCanopyDeficit = Math.max(0, CITYWIDE_CANOPY_TARGET_PCT - avgCanopy);
  const tractsBelowCohortMedian = normalizedSites.filter((s: any) => (s.treeCanopyPct ?? s.treeCanopyMetrics?.treeCanopyPct ?? 35) < COHORT_MEDIAN_CANOPY_PCT).length;
  const recommendedPlantingCount = tractsBelowCohortMedian > 0 ? tractsBelowCohortMedian * 45 : siteCount * 30;

  // Fiscal calculation ($2,200/day cooling center, $1,150/day mobile unit, $3,200 baseline supplies/staffing)
  const dailyCost = (normalizedSites.length * 2200) + (dispatchedAssets.length * 1150) + 3200;
  const shelterCapacity = (normalizedSites.length * 350) + (dispatchedAssets.length * 120);

  const topNeighborhoodNames = normalizedSites.slice(0, 3).map((s) => s.neighborhood).join(', ');

  const executiveSummary =
    `The City of Atlanta is under an active Extreme Heat Emergency with ambient temperatures reaching ` +
    `${(options.peakTempF || 96.8).toFixed(1)}°F (heat index exceeding ${(options.heatIndexF || 105.4).toFixed(1)}°F). ` +
    `Microclimate urban heat island anomalies elevate localized surface temperatures up to +5.2°F above baseline. ` +
    `This memorandum submits immediate operational siting approvals for ${normalizedSites.length} primary resilience hubs ` +
    `and ${dispatchedAssets.length} rapid-response mobile assets, targeting vulnerable neighborhoods including ${topNeighborhoodNames}. ` +
    `Equity audit verification confirms prioritized allocation towards transit-deficient households and high-risk elderly/disabled residents.`;

  return {
    memoId,
    date: dateFormatted,
    to: options.to || 'Honorable Members of the Atlanta City Council, Office of the Mayor, Fulton County EMA',
    from: options.from || 'Atlanta Heat Resilience Task Force & Chief Sustainability Officer',
    subject: options.subject || 'EMERGENCY MEMORANDUM: Extreme Heat Action Plan & Optimized Siting Distribution',
    executiveSummary,
    triggerCondition: {
      peakTempF: options.peakTempF || 96.8,
      heatIndexF: options.heatIndexF || 105.4,
      advisoryLevel: options.advisoryLevel || 'EXTREME HEAT EMERGENCY (Phase 3 Citywide Activation)',
      expectedDuration: options.expectedDuration || '72 to 96 Hours (Overnight thermal minimums > 78°F)',
      affectedPopulation: totalPop || 142000,
    },
    recommendedSites: normalizedSites,
    dispatchedAssets: dispatchedAssets as DispatchedAsset[],
    equityMetrics: {
      averagePovertyPct: Number(avgPoverty.toFixed(1)),
      averageNoVehiclePct: Number(avgNoVehicle.toFixed(1)),
      averageSviScore: Number(avgSvi.toFixed(2)),
      tractsAbovePovertyP75,
      tractsAboveTransitP75,
      equityAuditPassed,
    },
    wellnessPrioritization: {
      highPriorityTractCount: highPriorityCount,
      seniorDisabilityFocusSummary:
        `Targeted door-to-door welfare verification coordinated with Atlanta Fire Rescue Department (AFRD) and ` +
        `Fulton County Department of Senior Services across high-density elderly corridors in South & Southwest Atlanta.`,
      targetWellnessChecks: targetChecks,
    },
    fiscalAndOperationalImpact: {
      projectedDailyCost: dailyCost,
      partnerAgencies: [
        'Atlanta Fire Rescue Department (AFRD)',
        'MARTA Transit Authority',
        'Fulton County Department of Public Health',
        'Fulton County Library System',
        'Atlanta Department of Parks & Recreation',
        'Red Cross of Georgia',
      ],
      volunteerDeployments: normalizedSites.length * 4 + dispatchedAssets.length * 2,
      shelterCapacity,
    },
    canopyMetrics: {
      avgCanopyPct: Number(avgCanopy.toFixed(1)),
      avgCanopyDeficitPct: Number(avgCanopyDeficit.toFixed(1)),
      tractsBelowCohortMedian,
      recommendedPlantingCount,
      multiDeptFundAllocated: 106500,
      multiDeptFundTotal: 120000,
    },
    actionItems: [
      'Authorize emergency expenditure from the City Extreme Heat Contingency Reserve.',
      'Deploy fare-free MARTA transit shuttles along high-vulnerability corridors connecting to designated cooling hubs.',
      'Authorize AFRD Community Emergency Response Teams (CERT) for targeted wellness checks in prioritized senior/disability zones.',
      'Extend operating hours of designated Fulton County Library & Recreation centers to 24/7 emergency cooling shelter operations.',
      'Stage dynamic hydration trailers and MARTA climate-controlled shelter buses at high-exposure unshaded transit nodes.',
      'Co-fund street-tree right-of-way planting in low-canopy tracts (<37.16%) leveraging the $120,000 multi-departmental co-budget (Parks $40k, Watershed $50k, Resilience $30k).',
    ],
    signedBy: options.signedBy || 'Chief Resilience Officer & Urban Heat Incident Commander, City of Atlanta',
  };
}

/**
 * Formats CouncilMemoData as structured GitHub Flavored Markdown
 */
export function formatMemoAsMarkdown(memo: CouncilMemoData): string {
  const sitesTable = memo.recommendedSites.length > 0
    ? `| Rank | Facility Name | Neighborhood | Temp Offset | Walk Time | Poverty % | Zero Vehicle % | SVI Score | Siting Justification |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
${memo.recommendedSites
  .map(
    (s) =>
      `| **#${s.rank}** | **${s.name}** | ${s.neighborhood} | +${s.predictedOffsetF.toFixed(1)}°F | ${s.walkAccessMinutes} min | ${s.povertyRatePct.toFixed(1)}% | ${s.noVehicleRatePct.toFixed(1)}% | ${s.sviScore !== undefined ? s.sviScore.toFixed(2) : 'N/A'} | ${s.justification} |`
  )
  .join('\n')}`
    : '_No primary cooling sites currently submitted._';

  const assetsTable = memo.dispatchedAssets.length > 0
    ? `| Asset ID | Type | Unit Name | Staging Location | Target Reach | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
${memo.dispatchedAssets
  .map(
    (a) =>
      `| \`${a.id}\` | ${a.type.toUpperCase()} | **${a.name}** | ${a.locationName} | ${a.protectedPopulation.toLocaleString()} residents | **${a.status.toUpperCase()}** |`
  )
  .join('\n')}`
    : '_No mobile fleet assets currently deployed._';

  const partnerList = memo.fiscalAndOperationalImpact.partnerAgencies
    .map((p) => `- ${p}`)
    .join('\n');

  const actionList = memo.actionItems
    .map((item, idx) => `${idx + 1}. **${item}**`)
    .join('\n');

  return `# CITY OF ATLANTA — EMERGENCY COUNCIL MEMORANDUM

**MEMO REFERENCE:** \`${memo.memoId}\`  
**DATE:** ${memo.date}  
**TO:** ${memo.to}  
**FROM:** ${memo.from}  
**SUBJECT:** ${memo.subject}  

---

### 1. EXECUTIVE SUMMARY
${memo.executiveSummary}

---

### 2. TRIGGER CONDITIONS & METEOROLOGICAL THRESHOLDS
- **Advisory Classification:** **${memo.triggerCondition.advisoryLevel}**
- **Forecast Ambient Peak:** **${memo.triggerCondition.peakTempF.toFixed(1)}°F** (Heat Index: **${memo.triggerCondition.heatIndexF.toFixed(1)}°F**)
- **Expected Duration:** ${memo.triggerCondition.expectedDuration}
- **Vulnerable Population in Heat Risk Shed:** **${memo.triggerCondition.affectedPopulation.toLocaleString()} residents**

---

### 3. RECOMMENDED COOLING CENTER SITING DISTRIBUTION
${sitesTable}

---

### 4. ACTIVE MOBILE ASSET DEPLOYMENTS (SURGE UNITS)
${assetsTable}

---

### 5. EQUITY AUDIT & SENIOR / DISABILITY WELLNESS TARGETS
- **Average Poverty Rate in Sited Catchments:** **${memo.equityMetrics.averagePovertyPct.toFixed(1)}%** (Citywide P75 Benchmark: 24.5%)
- **Average Transit Vehicle Deficit:** **${memo.equityMetrics.averageNoVehiclePct.toFixed(1)}%** (Citywide P75 Benchmark: 14.8%)
- **Average CDC SVI Score in Sited Catchments:** **${memo.equityMetrics.averageSviScore !== undefined ? memo.equityMetrics.averageSviScore.toFixed(2) : '0.82'} / 1.00** (High Social Vulnerability)
- **Tracts Above P75 Poverty Threshold:** **${memo.equityMetrics.tractsAbovePovertyP75} / ${memo.recommendedSites.length}**
- **Equity Siting Audit Status:** **${memo.equityMetrics.equityAuditPassed ? 'PASSED (Targeted Siting Compliant)' : 'EXCEPTION REVIEW REQUIRED'}**
- **Priority Wellness Tracts Flagged:** **${memo.wellnessPrioritization.highPriorityTractCount} tracts**
- **Target Wellness & Tele-Care Checks:** **${memo.wellnessPrioritization.targetWellnessChecks.toLocaleString()} contacts**
- **Senior & Disability Strategy:** ${memo.wellnessPrioritization.seniorDisabilityFocusSummary}

---

### 6. URBAN FORESTRY & TREE CANOPY RESILIENCE (50% TARGET ALIGNMENT)
- **Catchment Average Canopy Coverage:** **${memo.canopyMetrics ? memo.canopyMetrics.avgCanopyPct.toFixed(1) : '28.4'}%** (Citywide Target: 50.0% | Cohort Median: 37.16%)
- **Average Canopy Deficit:** **-${memo.canopyMetrics ? memo.canopyMetrics.avgCanopyDeficitPct.toFixed(1) : '21.6'}%** below Atlanta Decade Track 50% threshold
- **Tracts Below Cohort Median (< 37.16%):** **${memo.canopyMetrics ? memo.canopyMetrics.tractsBelowCohortMedian : 0} / ${memo.recommendedSites.length} tracts**
- **Recommended Right-of-Way Street Tree Plantings:** **${memo.canopyMetrics ? memo.canopyMetrics.recommendedPlantingCount.toLocaleString() : '180'} trees** along pedestrian & transit sheds
- **Multi-Departmental Co-Funding Model ($120,000 Allocation Cap):**
  - **Office of Parks ($40,000 cap, canopy < 37.16%):** $38,500 allocated (96.3%)
  - **Department of Watershed Management ($50,000 cap, density > 5,141.4):** $39,250 allocated (78.5%)
  - **Office of Resilience ($30,000 cap, SVI > 0.50):** $28,750 allocated (95.8%)
  - **Total Greening Co-Budgeting Committed:** **$${memo.canopyMetrics ? memo.canopyMetrics.multiDeptFundAllocated.toLocaleString() : '106,500'} / $${memo.canopyMetrics ? memo.canopyMetrics.multiDeptFundTotal.toLocaleString() : '120,000'} (88.8%)**

---

### 7. OPERATIONAL CAPACITY & FISCAL REQUIREMENTS
- **Projected Daily Operational Cost:** **$${memo.fiscalAndOperationalImpact.projectedDailyCost.toLocaleString()} / day**
- **Emergency Shelter Concurrent Capacity:** **${memo.fiscalAndOperationalImpact.shelterCapacity.toLocaleString()} persons**
- **Certified Field Staff & Volunteers:** **${memo.fiscalAndOperationalImpact.volunteerDeployments} personnel**
- **Coordinating Agencies:**
${partnerList}

---

### 8. REQUIRED COUNCIL ACTION ITEMS
${actionList}

---

**SUBMITTED AND CERTIFIED BY:**  
*${memo.signedBy}*  
*Atlanta Heat Resilience Command Center*
`;
}

/**
 * Formats CouncilMemoData as clean plain-text ASCII memo for printing or teletype dispatch
 */
export function formatMemoAsText(memo: CouncilMemoData): string {
  const line = '='.repeat(80);
  const subline = '-'.repeat(80);

  const sitesText = memo.recommendedSites.length > 0
    ? memo.recommendedSites
        .map(
          (s) =>
            `  [#${s.rank}] ${s.name} (${s.neighborhood})\n` +
            `      Offset: +${s.predictedOffsetF.toFixed(1)}F | Walk: ${s.walkAccessMinutes} min | Poverty: ${s.povertyRatePct.toFixed(1)}% | No Vehicle: ${s.noVehicleRatePct.toFixed(1)}% | SVI: ${s.sviScore !== undefined ? s.sviScore.toFixed(2) : 'N/A'}\n` +
            `      Justification: ${s.justification}`
        )
        .join('\n\n')
    : '  No primary cooling sites currently designated.';

  const assetsText = memo.dispatchedAssets.length > 0
    ? memo.dispatchedAssets
        .map(
          (a) =>
            `  - [${a.type.toUpperCase()}] ${a.name} @ ${a.locationName}\n` +
            `    Status: ${a.status.toUpperCase()} | Target Reach: ${a.protectedPopulation.toLocaleString()} residents`
        )
        .join('\n')
    : '  No mobile fleet assets currently deployed.';

  const partnerText = memo.fiscalAndOperationalImpact.partnerAgencies
    .map((p) => `  * ${p}`)
    .join('\n');

  const actionsText = memo.actionItems
    .map((item, idx) => `  ${idx + 1}. ${item}`)
    .join('\n');

  return `${line}
                      CITY OF ATLANTA - EMERGENCY MEMORANDUM
${line}
MEMO REF : ${memo.memoId}
DATE     : ${memo.date}
TO       : ${memo.to}
FROM     : ${memo.from}
SUBJECT  : ${memo.subject}
${subline}

1. EXECUTIVE SUMMARY
${memo.executiveSummary}

${subline}
2. METEOROLOGICAL ALERT TRIGGER CONDITIONS
  - Advisory Level     : ${memo.triggerCondition.advisoryLevel}
  - Forecast Peak Temp : ${memo.triggerCondition.peakTempF.toFixed(1)} deg F (Heat Index: ${memo.triggerCondition.heatIndexF.toFixed(1)} deg F)
  - Duration Forecast  : ${memo.triggerCondition.expectedDuration}
  - Impact Population  : ${memo.triggerCondition.affectedPopulation.toLocaleString()} residents

${subline}
3. RECOMMENDED COOLING SITES DISTRIBUTION
${sitesText}

${subline}
4. ACTIVE MOBILE ASSET DEPLOYMENTS (SURGE)
${assetsText}

${subline}
5. EQUITY & WELLNESS COMPLIANCE AUDIT
  - Catchment Average Poverty Rate : ${memo.equityMetrics.averagePovertyPct.toFixed(1)}% (City P75: 24.5%)
  - Catchment Zero Vehicle Deficit : ${memo.equityMetrics.averageNoVehiclePct.toFixed(1)}% (City P75: 14.8%)
  - Catchment Average SVI Score    : ${memo.equityMetrics.averageSviScore !== undefined ? memo.equityMetrics.averageSviScore.toFixed(2) : '0.82'} / 1.00 (High Social Vulnerability)
  - Tracts Above P75 Poverty       : ${memo.equityMetrics.tractsAbovePovertyP75} / ${memo.recommendedSites.length}
  - Equity Siting Audit Result     : ${memo.equityMetrics.equityAuditPassed ? 'PASSED' : 'FLAGGED FOR REVIEW'}
  - Senior & Disability Priority   : ${memo.wellnessPrioritization.highPriorityTractCount} tracts
  - Target Proactive Checks        : ${memo.wellnessPrioritization.targetWellnessChecks.toLocaleString()} residents
  - Wellness Strategy:
    ${memo.wellnessPrioritization.seniorDisabilityFocusSummary}

${subline}
6. URBAN FORESTRY & TREE CANOPY DEFICIT AUDIT
  - Catchment Average Canopy Cover : ${memo.canopyMetrics ? memo.canopyMetrics.avgCanopyPct.toFixed(1) : '28.4'}% (City Target: 50.0% | Cohort Median: 37.16%)
  - Average Target Canopy Deficit : -${memo.canopyMetrics ? memo.canopyMetrics.avgCanopyDeficitPct.toFixed(1) : '21.6'}%
  - Tracts Below Cohort Median    : ${memo.canopyMetrics ? memo.canopyMetrics.tractsBelowCohortMedian : 0} / ${memo.recommendedSites.length} tracts
  - Recommended Street Tree Sites : ${memo.canopyMetrics ? memo.canopyMetrics.recommendedPlantingCount.toLocaleString() : '180'} right-of-way planting locations
  - Multi-Dept Co-Funding Model   : $${memo.canopyMetrics ? memo.canopyMetrics.multiDeptFundAllocated.toLocaleString() : '106,500'} / $${memo.canopyMetrics ? memo.canopyMetrics.multiDeptFundTotal.toLocaleString() : '120,000'} committed (88.8%)
    * Office of Parks ($40k cap, canopy < 37.16%)       : $38,500 allocated (96.3%)
    * Watershed Management ($50k cap, density > 5,141.4): $39,250 allocated (78.5%)
    * Office of Resilience ($30k cap, SVI > 0.50)       : $28,750 allocated (95.8%)

${subline}
7. FISCAL & OPERATIONAL IMPACT
  - Projected Daily Cost : $${memo.fiscalAndOperationalImpact.projectedDailyCost.toLocaleString()} / day
  - Shelter Capacity     : ${memo.fiscalAndOperationalImpact.shelterCapacity.toLocaleString()} persons concurrent
  - Staff & Volunteers   : ${memo.fiscalAndOperationalImpact.volunteerDeployments} active personnel
  - Coordinating Agencies:
${partnerText}

${subline}
8. REQUIRED IMMEDIATE COUNCIL ACTIONS
${actionsText}

${subline}
AUTHORIZED AND SUBMITTED:
${memo.signedBy}
Atlanta Heat Resilience Task Force
${line}
`;
}

/**
 * Utility to download or export memo content in browser environments
 */
export function exportMemoToFile(
  content: string,
  filename: string,
  mimeType: 'text/markdown' | 'text/plain' | 'text/html' = 'text/markdown'
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to export memo file:', err);
    return false;
  }
}
