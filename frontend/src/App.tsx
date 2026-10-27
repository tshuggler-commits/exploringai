import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeatMap } from './components/HeatMap';
import { DecisionsAndDispatch } from './components/DecisionsAndDispatch';
import { CoolingCenterRankings } from './components/CoolingCenterRankings';
import { EquityAuditDashboard } from './components/EquityAuditDashboard';
import { HistoricalTrends } from './components/HistoricalTrends';
import { AdvisorChat } from './components/AdvisorChat';
import { ExplainabilityModal } from './components/ExplainabilityModal';
import { GlossaryModal } from './components/GlossaryModal';
import { CouncilMemoModal } from './components/CouncilMemoModal';
import { useUI } from './context/UIContext';
import { 
  MOCK_CENSUS_TRACTS, 
  MOCK_COOLING_CENTER_RANKINGS,
  INITIAL_PLANNER_DECISIONS,
  INITIAL_DISPATCHED_ASSETS,
  INITIAL_HEAT_ALERTS
} from './data/mockData';
import { CensusTract, CoolingCenterRanking, PlannerDecision, DispatchedAsset, AssetType, HeatAlert } from './types';
import { agentApi, CLOUD_RUN_URL } from './services/agentApi';

export const App: React.FC = () => {
  const { openCouncilMemo } = useUI();
  const [activeTab, setActiveTab] = useState<string>('map');
  const [isCloudRunConnected, setIsCloudRunConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [useMockMode, setUseMockMode] = useState<boolean>(false);
  const [forecastBaselineF, setForecastBaselineF] = useState<number>(92);

  const [selectedTract, setSelectedTract] = useState<CensusTract | null>(MOCK_CENSUS_TRACTS[0]);
  const [explainTract, setExplainTract] = useState<CensusTract | null>(null);
  const [advisorPrompt, setAdvisorPrompt] = useState<string | undefined>(undefined);

  // New synthesized state from feat/frontend-rev
  const [plannerDecisions, setPlannerDecisions] = useState<PlannerDecision[]>(INITIAL_PLANNER_DECISIONS);
  const [dispatchedAssets, setDispatchedAssets] = useState<DispatchedAsset[]>(INITIAL_DISPATCHED_ASSETS);
  const [heatAlerts] = useState<HeatAlert[]>(INITIAL_HEAT_ALERTS);

  // Ping health of deployed Cloud Run service
  const verifyAgentHealth = async () => {
    const res = await agentApi.checkHealth();
    setIsCloudRunConnected(res.ok);
    setLatencyMs(res.latencyMs);
  };

  useEffect(() => {
    verifyAgentHealth();
    const timer = setInterval(verifyAgentHealth, 30000); // Check every 30s
    return () => clearInterval(timer);
  }, []);

  const handleAskAgentAboutTract = (tract: CensusTract) => {
    const prompt = `Provide a microclimate vulnerability assessment for ${tract.neighborhood} (Census Tract ${tract.geoId}). Why does it run ${tract.predictedOffsetF > 0 ? '+' : ''}${tract.predictedOffsetF}°F above baseline?`;
    setAdvisorPrompt(prompt);
    setActiveTab('advisor');
  };

  const handleSelectRanking = (rank: CoolingCenterRanking) => {
    const tract = MOCK_CENSUS_TRACTS.find((t) => t.geoId === rank.tractId);
    if (tract) {
      setSelectedTract(tract);
      setExplainTract(tract);
    }
  };

  const handleAuditRecommendations = (_selected: CoolingCenterRanking[]) => {
    setActiveTab('equity');
  };

  const handleDraftCouncilProposal = (selected?: CoolingCenterRanking[]) => {
    const targets = selected && selected.length > 0 ? selected : MOCK_COOLING_CENTER_RANKINGS.slice(0, 5);
    openCouncilMemo({
      sites: targets,
      dispatchedAssets,
    });
  };

  const handleExecuteDecision = (decision: PlannerDecision) => {
    // Mark decision as executed
    setPlannerDecisions((prev) =>
      prev.map((d) => (d.id === decision.id ? { ...d, status: 'executed' } : d))
    );

    if (decision.actionType === 'draft_council') {
      handleDraftCouncilProposal();
      return;
    }

    // Map decision to asset type
    const assetType: AssetType =
      decision.actionType === 'deploy_hydration'
        ? 'hydration'
        : decision.actionType === 'deploy_wellness'
        ? 'wellness'
        : 'bus';

    const assetName =
      assetType === 'hydration'
        ? `Hydration Trailer #${dispatchedAssets.length + 1}`
        : assetType === 'wellness'
        ? `Mobile Wellness Van #${dispatchedAssets.length + 1}`
        : `MARTA Climate Shelter Bus #${dispatchedAssets.length + 1}`;

    const newAsset: DispatchedAsset = {
      id: `disp-${Date.now()}`,
      type: assetType,
      name: assetName,
      locationName: decision.locationName || 'Atlanta Target Zone',
      lat: decision.lat || 33.749,
      lng: decision.lng || -84.388,
      tractId: decision.tractId,
      dispatchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'on-site',
      protectedPopulation: decision.impactPopulation,
    };

    setDispatchedAssets((prev) => [newAsset, ...prev]);

    // Focus on tract if provided
    if (decision.tractId) {
      const tract = MOCK_CENSUS_TRACTS.find((t) => t.geoId === decision.tractId);
      if (tract) setSelectedTract(tract);
    }
  };

  const handleDeployAsset = (
    type: AssetType,
    locationName: string,
    lat: number,
    lng: number,
    tractId?: string
  ) => {
    const assetName =
      type === 'hydration'
        ? `Hydration Trailer #${dispatchedAssets.length + 1}`
        : type === 'wellness'
        ? `Mobile Wellness Van #${dispatchedAssets.length + 1}`
        : `MARTA Climate Shelter Bus #${dispatchedAssets.length + 1}`;

    const newAsset: DispatchedAsset = {
      id: `disp-${Date.now()}`,
      type,
      name: assetName,
      locationName,
      lat,
      lng,
      tractId,
      dispatchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'on-site',
      protectedPopulation: 2200,
    };

    setDispatchedAssets((prev) => [newAsset, ...prev]);
  };

  const handleRecallAsset = (id: string) => {
    setDispatchedAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSelectTractForMap = (tractId: string) => {
    const tract = MOCK_CENSUS_TRACTS.find((t) => t.geoId === tractId);
    if (tract) {
      setSelectedTract(tract);
      setActiveTab('map');
    }
  };

  const pendingDecisionsCount = plannerDecisions.filter((d) => d.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCloudRunConnected={isCloudRunConnected}
        latencyMs={latencyMs}
        useMockMode={useMockMode}
        setUseMockMode={setUseMockMode}
        onRefreshHealth={verifyAgentHealth}
        cloudRunUrl={CLOUD_RUN_URL}
        alerts={heatAlerts}
        baselineTempF={forecastBaselineF}
        pendingDecisionsCount={pendingDecisionsCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'map' && (
          <HeatMap
            tracts={MOCK_CENSUS_TRACTS}
            selectedTract={selectedTract}
            onSelectTract={(t) => setSelectedTract(t)}
            onAskAgentAboutTract={handleAskAgentAboutTract}
            forecastBaselineF={forecastBaselineF}
            dispatchedAssets={dispatchedAssets}
            onRecallAsset={handleRecallAsset}
            onSwitchToDecisions={() => setActiveTab('decisions')}
            onDeployAsset={handleDeployAsset}
          />
        )}

        {activeTab === 'decisions' && (
          <DecisionsAndDispatch
            decisions={plannerDecisions}
            dispatchedAssets={dispatchedAssets}
            onExecuteDecision={handleExecuteDecision}
            onDeployAsset={handleDeployAsset}
            onRecallAsset={handleRecallAsset}
            onSelectTractForMap={handleSelectTractForMap}
            onDraftCouncilProposal={() => handleDraftCouncilProposal()}
            allTracts={MOCK_CENSUS_TRACTS}
          />
        )}

        {activeTab === 'siting' && (
          <CoolingCenterRankings
            rankings={MOCK_COOLING_CENTER_RANKINGS}
            forecastBaselineF={forecastBaselineF}
            setForecastBaselineF={setForecastBaselineF}
            onSelectRanking={handleSelectRanking}
            onAuditRecommendations={handleAuditRecommendations}
            onDraftCouncilProposal={handleDraftCouncilProposal}
          />
        )}

        {activeTab === 'equity' && (
          <EquityAuditDashboard recommendedSites={MOCK_COOLING_CENTER_RANKINGS.slice(0, 3)} />
        )}

        {activeTab === 'history' && <HistoricalTrends />}

        {activeTab === 'advisor' && (
          <AdvisorChat
            useMockMode={useMockMode}
            initialPrompt={advisorPrompt}
            onClearInitialPrompt={() => setAdvisorPrompt(undefined)}
          />
        )}
      </main>

      {/* Feature Attribution Explainability Modal */}
      <ExplainabilityModal
        isOpen={!!explainTract}
        onClose={() => setExplainTract(null)}
        tract={explainTract}
      />

      {/* Glossary & Terminology Modal */}
      <GlossaryModal />

      {/* Official City Council Emergency Heat Memo Modal */}
      <CouncilMemoModal />
    </div>
  );
};
export default App;

