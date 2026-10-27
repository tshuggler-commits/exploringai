export interface GlossaryItem {
  id: string;
  term: string;
  shortDefinition: string;
  detailedExplanation: string;
  formulaOrStandard?: string;
  dataSources: string[];
  operationalApplication: string;
  category: 'Climate & Heat' | 'Vulnerability & Demographics' | 'Operations & Logistics' | 'Explainable AI';
}

export const GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    id: 'cdc-svi',
    term: 'CDC SVI (Social Vulnerability Index)',
    category: 'Vulnerability & Demographics',
    shortDefinition:
      'A standardized 0.00 to 1.00 composite index score created by the CDC and ATSDR measuring relative community vulnerability to natural hazards and public health emergencies.',
    detailedExplanation:
      'The Centers for Disease Control and Prevention / Agency for Toxic Substances and Disease Registry (CDC/ATSDR) Social Vulnerability Index synthesizes 16 census-derived indicators across four structural themes: Socioeconomic Status, Household Characteristics, Racial & Ethnic Minority Status, and Housing Type & Transportation. Tracts are scored as a standard 0.00 to 1.00 index score (e.g., 0.85 indicates high vulnerability, where 0.00 is least vulnerable and 1.00 is most vulnerable). Tracts scoring 0.75 or higher represent the most vulnerable quartile in Georgia. In heat disaster planning, high-SVI communities suffer from compounding vulnerabilities including lower central air conditioning penetration, higher baseline chronic illness rates, and reduced financial cushion for energy bills.',
    formulaOrStandard:
      'SVI Score = Standardized 0.00 to 1.00 composite score (0.00 = lowest vulnerability, 1.00 = highest vulnerability). Scores ≥ 0.75 designate high-vulnerability tracts.',
    dataSources: [
      'CDC/ATSDR Social Vulnerability Index (2020/2022)',
      'U.S. Census Bureau American Community Survey (ACS) 5-Year Estimates',
      'Georgia Department of Public Health OASIS System',
    ],
    operationalApplication:
      'Directly weighted into the composite cooling center ranking algorithm (30% weight) and prioritized mobile fleet dispatch schedules to ensure equitable resource allocation to historically underserved neighborhoods.',
  },
  {
    id: 'thermal-offset',
    term: 'Thermal Offset (°F)',
    category: 'Climate & Heat',
    shortDefinition:
      'The localized temperature anomaly above the citywide baseline reference station (Hartsfield-Jackson Atlanta International Airport).',
    detailedExplanation:
      'Thermal offset quantifies the localized intensity of the Urban Heat Island (UHI) effect across Atlanta census tracts. Heavy concentrations of asphalt pavement, dark commercial roof membranes, highway corridors (I-75/85 Downtown Connector, I-20), and low tree canopy trap incoming solar radiation, driving microclimates up to +5.2°F hotter than regional weather forecasts. An airport reading of 94°F translates to 99°F+ in heat-offset corridors like Downtown, Sweet Auburn, Peoplestown, and English Avenue.',
    formulaOrStandard:
      'Localized Ambient Temp (°F) = Baseline Regional Temp (°F) + Predicted Microclimate Thermal Offset (°F)',
    dataSources: [
      'NASA ECOSTRESS Land Surface Temperature Thermal Radiometer',
      'NOAA / CAPA Strategies Atlanta Urban Heat Island Campaign',
      'City of Atlanta Environmental Sensor Network & Weather Underground PWS',
    ],
    operationalApplication:
      'Determines localized alert activation thresholds, sizing of air conditioning tonnage requirements for resilience hubs, and trigger points for citywide Phase 2/Phase 3 heat emergencies.',
  },
  {
    id: 'walk-catchment-shed',
    term: '10-Minute Walk Catchment Shed',
    category: 'Operations & Logistics',
    shortDefinition:
      'A 0.5-mile walkable pedestrian network radius surrounding a designated cooling center or resilience facility.',
    detailedExplanation:
      'During extreme heat emergencies (ambient temperatures >90°F with heat index >100°F), prolonged walking outdoors quickly induces dangerous thermal strain, exertional heat exhaustion, and dehydration—especially for seniors, unhoused residents, and individuals with cardiovascular conditions. A 10-minute pedestrian walk catchment (~0.5 miles along the actual street and sidewalk network, avoiding rail barriers and freeways) is the medically established safe outdoor transit limit. Neighborhoods outside this walkshed are classified as "cooling deserts" requiring mobile intervention.',
    formulaOrStandard:
      'Pedestrian Network Distance ≤ 0.5 miles (800 meters) at 3.0 mph walking velocity, mapped along connected sidewalk paths and accessible crosswalks.',
    dataSources: [
      'City of Atlanta Department of Transportation (ATLDOT) Sidewalk GIS Inventory',
      'OpenStreetMap Pedestrian Routing Network',
      'MARTA Bus Stop & Rail Access Layer',
    ],
    operationalApplication:
      'Defines the protected service zone for each brick-and-mortar cooling center. Areas with high heat risk outside any 10-minute walkshed are automatically assigned top dispatch priority for mobile hydration stations and MARTA shelter buses.',
  },
  {
    id: 'wellness-check-thresholds',
    term: 'Senior & Disability Wellness Check Thresholds',
    category: 'Vulnerability & Demographics',
    shortDefinition:
      'Operational screening criteria that prioritize census tracts for proactive door-to-door, tele-care, and first-responder welfare verification based on elderly isolation and functional disability rates.',
    detailedExplanation:
      'Senior citizens living alone and individuals with physical, cognitive, or sensory disabilities face disproportionate mortality in urban heatwaves due to impaired biological thermoregulation, mobility limitations, and social isolation. The Atlanta Heat Resilience system flags a census tract for Priority Wellness Response when it combines severe microclimate heat (Thermal Offset ≥ 3.2°F) and high social vulnerability (SVI ≥ 0.65) with high senior isolation (≥ 18% of seniors living alone) or elevated disability rates (≥ 15% civilian noninstitutionalized disability).',
    formulaOrStandard:
      'Wellness Priority Flag = (Thermal Offset ≥ 3.2°F) ∧ (CDC SVI ≥ 0.65) ∧ [(Seniors Living Alone Pct ≥ 18.0%) ∨ (Disability Rate Pct ≥ 15.0%)]',
    dataSources: [
      'U.S. Census Bureau ACS (Tables B11010 "Living Alone" and S1810 "Disability Characteristics")',
      'Atlanta Area Agency on Aging (ARC Aging & Independence Services)',
      'CDC PLACES Local Health Data for Small Areas',
    ],
    operationalApplication:
      'Directly generates targeted dispatch manifests for Atlanta Fire Rescue Department (AFRD) CERT teams, Red Cross volunteers, and Fulton County Senior Services to conduct in-person welfare visits and distribute battery-operated emergency fans.',
  },
  {
    id: 'poverty-vehicle-deficit',
    term: 'Poverty Rate & Vehicle Deficit',
    category: 'Vulnerability & Demographics',
    shortDefinition:
      'Dual equity metrics measuring economic distress (percentage below federal poverty threshold) and transit dependency (percentage of zero-vehicle households).',
    detailedExplanation:
      'Poverty and zero-vehicle ownership represent the primary compounding socioeconomic barriers to extreme heat survival. Low-income households experience extreme "energy burden" (often spending >10% of income on utility bills) and may ration or lack air conditioning. Zero-vehicle households cannot easily drive to regional air-conditioned shopping malls or community centers. In Atlanta, the 75th percentile citywide benchmarks are 24.5% poverty rate and 14.8% zero-vehicle households. Siting cooling infrastructure above these benchmarks ensures equity compliance.',
    formulaOrStandard:
      'Equity Benchmark Compliance: Catchment Poverty Rate ≥ 24.5% (Citywide P75) | Catchment Zero-Vehicle Households ≥ 14.8% (Citywide P75)',
    dataSources: [
      'U.S. Census ACS 5-Year Estimates (Tables S1701 "Poverty" & B25044 "Vehicles Available")',
      'Atlanta Regional Commission (ARC) Equity Priority Areas Index',
    ],
    operationalApplication:
      'Mandatory threshold test in the City Council Emergency Heat Memo audit. If recommended cooling centers fail to reach the P75 equity benchmarks, the system flags an audit warning and requires formal justification.',
  },
  {
    id: 'mobile-fleet-units',
    term: 'Mobile Fleet Units (Hydration, Wellness, MARTA Shelter Bus)',
    category: 'Operations & Logistics',
    shortDefinition:
      'Rapid-deployment vehicular emergency assets staged dynamically in transit deserts and microclimate heat hot spots lacking permanent cooling facilities.',
    detailedExplanation:
      'Mobile fleet assets provide immediate, agile thermal relief when permanent facilities are distant or operating beyond capacity:\n' +
      '• Hydration Units: Mobile trailers equipped with high-pressure evaporative misting canopies, chilled potable water distribution (400 gal capacity), electrolytes, and shaded rest benches (Capacity: ~400 persons/day).\n' +
      '• Wellness Vans: Sprinter vans staffed by emergency medical technicians/paramedics offering vital signs screening, rapid oral rehydration therapy, ice-bath immersion for acute hyperthermia, and outreach supplies (Capacity: ~250 checks/day).\n' +
      '• MARTA Shelter Buses: Standard 40-foot climate-controlled transit buses staged at major unshaded transfer stops and high-density pedestrian corridors, providing continuous air-conditioned respite (Capacity: ~120 persons/cycle).',
    formulaOrStandard:
      'Target Staging: Distance from nearest cooling center > 0.5 miles ∧ Localized Temp Offset ≥ 3.5°F ∧ Transit stop passenger volume > 200 daily boardings.',
    dataSources: [
      'Atlanta Fire Rescue Department (AFRD) Mobile Operations Telematics',
      'MARTA Fleet Operations & CAD/AVL Transit Management',
      'Atlanta Department of Watershed Management Hydration Logistics',
    ],
    operationalApplication:
      'Interactive GIS dispatch interface enables emergency managers to stage and route mobile units in real time, projecting shielded population count and updating Council emergency situational reports.',
  },
  {
    id: 'explainability-ai-attribution',
    term: 'Explainability & AI Microclimate Attribution',
    category: 'Explainable AI',
    shortDefinition:
      'Transparent machine learning feature attribution (SHAP / gradient decompositions) isolating the exact physical and environmental drivers of localized thermal spikes.',
    detailedExplanation:
      'Rather than relying on opaque predictions, microclimate attribution decomposes the predicted temperature offset for each Atlanta census tract into physical, measurable components. The underlying Gradient Boosted Decision Tree (XGBoost/LightGBM) model assesses relative feature importance using SHAP (Shapley Additive exPlanations). This identifies the exact degrees Fahrenheit contributed by tree canopy deficit (+1.85°F), impervious asphalt cover (+1.42°F), high building density (+0.78°F), and albedo deficit (+0.56°F).',
    formulaOrStandard:
      'Predicted Offset (°F) = Baseline Reference + ∑ [SHAP Value(Feature_i)] for features {Tree Canopy %, Impervious %, Building Density, Albedo, Walk Score}',
    dataSources: [
      'City of Atlanta High-Resolution Tree Canopy Assessment (LiDAR & Aerial Imagery)',
      'National Land Cover Database (NLCD) 30m Impervious Surface Dataset',
      'Fulton County Board of Assessors Geospatial Parcel & Building Footprints',
    ],
    operationalApplication:
      'Validates AI recommendations to City Council committees, providing transparent justification for why specific sites were selected and informing long-term urban forestry and cool-roof capital planning.',
  },
];

/**
 * Helper to retrieve a single glossary item by ID
 */
export function getGlossaryItem(id: string): GlossaryItem | undefined {
  return GLOSSARY_ITEMS.find((item) => item.id.toLowerCase() === id.toLowerCase());
}

/**
 * Helper to retrieve glossary items filtered by category
 */
export function getGlossaryByCategory(category: GlossaryItem['category']): GlossaryItem[] {
  return GLOSSARY_ITEMS.filter((item) => item.category === category);
}

/**
 * Full-text search across term titles, definitions, and explanations
 */
export function searchGlossary(query: string): GlossaryItem[] {
  if (!query || query.trim() === '') {
    return GLOSSARY_ITEMS;
  }
  const cleanQuery = query.toLowerCase().trim();
  return GLOSSARY_ITEMS.filter(
    (item) =>
      item.term.toLowerCase().includes(cleanQuery) ||
      item.shortDefinition.toLowerCase().includes(cleanQuery) ||
      item.detailedExplanation.toLowerCase().includes(cleanQuery) ||
      item.operationalApplication.toLowerCase().includes(cleanQuery) ||
      item.category.toLowerCase().includes(cleanQuery)
  );
}
