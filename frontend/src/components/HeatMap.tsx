import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { CensusTract, DispatchedAsset, AssetType } from '../types';
import { 
  Flame, 
  Users, 
  Navigation, 
  AlertTriangle, 
  Sparkles, 
  Info, 
  Search, 
  Crosshair, 
  Trees, 
  ShieldAlert, 
  X, 
  Truck,
  HeartHandshake,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal
} from 'lucide-react';
import { useMetricChoropleth } from '../hooks/useMetricChoropleth';
import { useUI } from '../context/UIContext';
import {
  calculateTractCanopyMetrics,
  isBivariateHotspot,
  CITYWIDE_CANOPY_TARGET_PCT,
  COHORT_MEDIAN_CANOPY_PCT,
  CRITICAL_CANOPY_THRESHOLD_PCT,
} from '../services/canopyService';

interface HeatMapProps {
  tracts: CensusTract[];
  selectedTract: CensusTract | null;
  onSelectTract: (tract: CensusTract) => void;
  onAskAgentAboutTract: (tract: CensusTract) => void;
  forecastBaselineF: number;
  dispatchedAssets?: DispatchedAsset[];
  onRecallAsset?: (id: string) => void;
  onSwitchToDecisions?: () => void;
  onDeployAsset?: (type: AssetType, locationName: string, lat: number, lng: number, tractId?: string) => void;
}

export const HeatMap: React.FC<HeatMapProps> = ({
  tracts,
  selectedTract,
  onSelectTract,
  onAskAgentAboutTract,
  forecastBaselineF,
  dispatchedAssets = [],
  onRecallAsset,
  onSwitchToDecisions,
  onDeployAsset,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const { openGlossary } = useUI();
  const { activeMetric, setActiveMetric, getColor, legendConfig } = useMetricChoropleth({
    initialMetric: 'heat',
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [minOffsetFilter, setMinOffsetFilter] = useState<number>(-3);
  const [minPovertyFilter, setMinPovertyFilter] = useState<number>(0);
  const [showWalkBuffers, setShowWalkBuffers] = useState<boolean>(true);
  const [onlyCandidates, setOnlyCandidates] = useState<boolean>(false);
  const [onlyWellnessPriority, setOnlyWellnessPriority] = useState<boolean>(false);
  const [showDispatchedAssets, setShowDispatchedAssets] = useState<boolean>(true);
  const [canopyFilter, setCanopyFilter] = useState<'all' | 'belowMedian' | 'critical'>('all');
  const [bivariateLens, setBivariateLens] = useState<boolean>(false);
  const [isFiltersMinimized, setIsFiltersMinimized] = useState<boolean>(false);
  const [selectedAsset, setSelectedAsset] = useState<DispatchedAsset | null>(null);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);

  // Count active filters differing from defaults
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (minOffsetFilter > -3) count++;
    if (minPovertyFilter > 0) count++;
    if (onlyCandidates) count++;
    if (onlyWellnessPriority) count++;
    if (canopyFilter !== 'all') count++;
    if (bivariateLens) count++;
    return count;
  }, [minOffsetFilter, minPovertyFilter, onlyCandidates, onlyWellnessPriority, canopyFilter, bivariateLens]);

  // Helper to determine whether a tract meets Senior & Disability wellness priority criteria
  const isWellnessPriority = (t: CensusTract): boolean => {
    return Boolean(
      t.wellnessPriority ||
      (t.seniorsLivingAlonePct !== undefined && t.seniorsLivingAlonePct >= 18) ||
      (t.disabilityRatePct !== undefined && t.disabilityRatePct >= 15) ||
      (t.sviScore !== undefined && t.sviScore >= 0.75 && t.predictedOffsetF >= 3.0)
    );
  };

  const wellnessTractsCount = useMemo(() => {
    return tracts.filter(isWellnessPriority).length;
  }, [tracts]);

  const bivariateHotspotsCount = useMemo(() => {
    return tracts.filter(isBivariateHotspot).length;
  }, [tracts]);

  // Tree canopy metrics for the currently selected tract
  const selectedCanopyMetrics = useMemo(() => {
    if (!selectedTract) return null;
    return calculateTractCanopyMetrics(selectedTract);
  }, [selectedTract]);

  // Calculate CDC SVI rank for selected tract among all tracts
  const sviRankInfo = useMemo(() => {
    if (!selectedTract || selectedTract.sviScore === undefined) return null;
    const sorted = [...tracts]
      .filter((t) => t.sviScore !== undefined)
      .sort((a, b) => (b.sviScore ?? 0) - (a.sviScore ?? 0));
    const rank = sorted.findIndex((t) => t.geoId === selectedTract.geoId) + 1;
    return { rank, total: sorted.length };
  }, [selectedTract, tracts]);

  // Filtered tracts for search autocomplete
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return tracts
      .filter(
        (t) =>
          t.neighborhood.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.geoId.includes(q) ||
          (t.coolingCenterName && t.coolingCenterName.toLowerCase().includes(q))
      )
      .slice(0, 7);
  }, [tracts, searchQuery]);

  const handleSelectAndFly = (tract: CensusTract) => {
    onSelectTract(tract);
    setSearchQuery('');
    setIsSearchFocused(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([tract.latitude, tract.longitude], 14, {
        duration: 1.0,
      });
    }
  };

  const handleDispatchWellnessVanToSelected = () => {
    if (!selectedTract) return;
    if (onDeployAsset) {
      onDeployAsset(
        'wellness',
        `${selectedTract.neighborhood} (Tract ${selectedTract.geoId})`,
        selectedTract.latitude,
        selectedTract.longitude,
        selectedTract.geoId
      );
      setDispatchFeedback(`Dispatched Wellness Van to ${selectedTract.neighborhood}!`);
      setTimeout(() => setDispatchFeedback(null), 3000);
    } else if (onSwitchToDecisions) {
      onSwitchToDecisions();
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [33.755, -84.39],
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Standard OpenStreetMap tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      // Map cleanup if needed
    };
  }, []);

  // Update markers and buffers when tracts, filters, or activeMetric change
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    layerGroupRef.current.clearLayers();

    const filtered = tracts.filter((t) => {
      if (t.predictedOffsetF < minOffsetFilter) return false;
      if (t.povertyRatePct < minPovertyFilter) return false;
      if (onlyCandidates && !t.hasCoolingCenter) return false;
      if (onlyWellnessPriority && !isWellnessPriority(t)) return false;
      if (canopyFilter === 'belowMedian' && (t.treeCanopyPct ?? 35) >= COHORT_MEDIAN_CANOPY_PCT) return false;
      if (canopyFilter === 'critical' && (t.treeCanopyPct ?? 35) >= CRITICAL_CANOPY_THRESHOLD_PCT) return false;
      return true;
    });

    filtered.forEach((tract) => {
      const color = getColor(activeMetric, tract);
      const isSelected = selectedTract?.geoId === tract.geoId;
      const isWellness = isWellnessPriority(tract);
      const isHotspot = isBivariateHotspot(tract);

      // Draw tract heat footprint circle colored by active choropleth metric
      const circle = L.circleMarker([tract.latitude, tract.longitude], {
        radius: isSelected ? 18 : bivariateLens && isHotspot ? 16 : 13,
        fillColor: color,
        color: isSelected
          ? '#ffffff'
          : bivariateLens && isHotspot
          ? '#f43f5e'
          : isWellness && onlyWellnessPriority
          ? '#fb7185'
          : color,
        weight: isSelected ? 3.5 : bivariateLens && isHotspot ? 3.5 : isWellness && onlyWellnessPriority ? 2.5 : 1.5,
        opacity: 0.95,
        fillOpacity: isSelected ? 0.92 : 0.68,
      });

      // Bivariate acute lens glowing outer ring
      if (bivariateLens && isHotspot) {
        const glowMarker = L.marker([tract.latitude, tract.longitude], {
          icon: L.divIcon({
            html: `<div class="bivariate-hotspot-glow" style="width:34px;height:34px;border-radius:9999px;border:2.5px solid #f43f5e;pointer-events:none;background:rgba(244,63,94,0.18);"></div>`,
            className: 'bivariate-hotspot-pin',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
          interactive: false,
          zIndexOffset: 450,
        });
        layerGroupRef.current?.addLayer(glowMarker);
      }

      // Tooltip for tract
      circle.bindTooltip(
        `<div class="p-1.5 font-sans text-xs min-w-[190px] leading-tight">
          <div class="font-bold text-slate-900">${tract.neighborhood}</div>
          <div class="text-[10px] text-slate-500 font-mono">Tract GEOID: ${tract.geoId}</div>
          <div class="text-slate-700 mt-1">Thermal Offset: <b style="color:${color};">${tract.predictedOffsetF > 0 ? '+' : ''}${tract.predictedOffsetF}°F</b></div>
          <div class="text-slate-700">Integrated Risk: <b>${tract.integratedRiskScore !== undefined ? tract.integratedRiskScore.toFixed(1) + '/100' : 'N/A'}</b></div>
          <div class="text-slate-700">Canopy: <b>${tract.treeCanopyPct ?? 'N/A'}%</b> | SVI: <b>${tract.sviScore !== undefined ? tract.sviScore.toFixed(2) : 'N/A'}</b></div>
          <div class="text-slate-700">Poverty: <b>${tract.povertyRatePct}%</b> | No Car: <b>${tract.noVehicleRatePct}%</b></div>
          ${tract.seniorsLivingAlonePct !== undefined ? `<div class="text-slate-700">Seniors Alone: <b>${tract.seniorsLivingAlonePct}%</b> | Disability: <b>${tract.disabilityRatePct ?? 14}%</b></div>` : ''}
          ${isHotspot ? '<div class="text-rose-600 font-semibold text-[10px] mt-1 pt-0.5 border-t border-slate-200">🔬 Bivariate Acute Hotspot (Heat > +3.5°F & Canopy < 30%)</div>' : ''}
          ${isWellness ? '<div class="text-rose-700 font-semibold text-[10px] mt-1 pt-0.5 border-t border-slate-200">🛡️ Senior & Disability Wellness Priority Zone</div>' : ''}
          ${tract.hasCoolingCenter ? '<div class="text-emerald-700 font-semibold text-[10px] mt-1 pt-0.5 border-t border-slate-200">🏛️ Identified Cooling Center Candidate</div>' : ''}
          <div class="text-indigo-600 font-medium text-[10px] mt-1">👉 Click tract to inspect full demographic & AI dossier</div>
        </div>`,
        { direction: 'top', className: 'rounded shadow-md' }
      );

      circle.on('click', () => {
        onSelectTract(tract);
      });

      layerGroupRef.current?.addLayer(circle);

      // Add 10-minute walk buffer (800 meters) around candidate cooling center sites
      if (showWalkBuffers && tract.hasCoolingCenter) {
        const buffer = L.circle([tract.latitude, tract.longitude], {
          radius: 800,
          fillColor: '#0ea5e9',
          color: '#0284c7',
          weight: 1.5,
          dashArray: '4, 4',
          fillOpacity: 0.12,
        });
        buffer.bindTooltip(
          `<div class="p-1 font-sans text-xs">
            <b class="text-sky-700">10-Minute Walk Buffer (800m)</b><br/>
            <span class="text-slate-800">Pedestrian shed to <b>${tract.coolingCenterName}</b></span><br/>
            <span class="text-slate-500 text-[10px]">Zero-vehicle pedestrian catchment zone</span>
          </div>`,
          { direction: 'bottom' }
        );
        buffer.on('click', () => {
          onSelectTract(tract);
        });
        layerGroupRef.current?.addLayer(buffer);
      }

      // Add prominent candidate cooling center pin
      if (tract.hasCoolingCenter) {
        const coolingIcon = L.divIcon({
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;border:2px solid #38bdf8;background:#0369a1;box-shadow:0 3px 10px rgba(0,0,0,0.5);font-size:13px;cursor:pointer;">
              🏛️
            </div>
          `,
          className: 'candidate-cooling-pin',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const coolingMarker = L.marker([tract.latitude, tract.longitude], {
          icon: coolingIcon,
          zIndexOffset: 600,
        });

        coolingMarker.bindTooltip(
          `<div class="p-1.5 font-sans text-xs min-w-[180px]">
            <div class="flex items-center gap-1">
              <span class="text-sm">🏛️</span>
              <b class="text-slate-900">${tract.coolingCenterName || 'Candidate Cooling Center'}</b>
            </div>
            <div class="text-[10px] text-sky-600 font-bold uppercase mt-0.5">Priority Cooling Site Candidate</div>
            <div class="text-slate-700 text-[11px] mt-1">Facility Type: <b>${tract.coolingCenterType || 'Recreation Center'}</b></div>
            <div class="text-slate-700 text-[11px]">Walk Access Score: <b>${tract.walkScore}/100</b></div>
            <div class="text-slate-700 text-[11px]">Integrated Risk: <b>${tract.integratedRiskScore !== undefined ? tract.integratedRiskScore.toFixed(1) + '/100' : 'N/A'}</b></div>
            <div class="text-rose-600 text-[11px]">Thermal Offset: <b>${tract.predictedOffsetF > 0 ? '+' : ''}${tract.predictedOffsetF}°F</b></div>
            <div class="text-sky-700 text-[10px] italic mt-1 font-semibold">👉 Click site to inspect full dossier</div>
          </div>`,
          { direction: 'top', offset: [0, -10] }
        );

        coolingMarker.on('click', () => {
          onSelectTract(tract);
        });

        layerGroupRef.current?.addLayer(coolingMarker);
      }
    });

    // Render active mobile dispatched assets (Resource Mover)
    if (showDispatchedAssets && dispatchedAssets && dispatchedAssets.length > 0) {
      dispatchedAssets.forEach((asset) => {
        const isHydration = asset.type === 'hydration';
        const isWellness = asset.type === 'wellness';
        const payloadIcon = isHydration ? '💧' : isWellness ? '🚑' : '🚌';
        const badgeColor = isHydration ? '#f59e0b' : isWellness ? '#6366f1' : '#06b6d4';
        const badgeBg = isHydration ? '#78350f' : isWellness ? '#312e81' : '#164e63';

        const customIcon = L.divIcon({
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;border:2px solid ${badgeColor};background:${badgeBg};box-shadow:0 3px 10px rgba(0,0,0,0.6);font-size:13px;cursor:pointer;">
              ${payloadIcon}
            </div>
          `,
          className: 'custom-asset-pin',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([asset.lat, asset.lng], { 
          icon: customIcon,
          zIndexOffset: 1000,
        });

        const payloadDescription = isHydration
          ? '1,000-gal chilled potable water reservoir + misting fans'
          : isWellness
          ? 'Paramedic triage team + cooling ice vests'
          : 'Air-conditioned mobile transit heat shelter';

        marker.bindTooltip(
          `<div class="p-2 font-sans text-xs min-w-[210px] leading-tight">
            <div class="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
              <span>🚚</span>
              <span>${payloadIcon}</span>
              <span>${asset.name}</span>
            </div>
            <div class="text-[10px] font-bold uppercase mt-0.5" style="color:${badgeColor};">
              ${isHydration ? 'Mobile Fleet (Trailer) • Hydration Payload' : isWellness ? 'Mobile Fleet (Van) • Paramedic Triage' : 'Mobile Transit • Cooling Shelter Bus'}
            </div>
            <div class="text-slate-700 mt-1.5">📍 <b>${asset.locationName}</b></div>
            <div class="text-slate-600 text-[11px] mt-0.5">Payload: ${payloadDescription}</div>
            <div class="text-emerald-700 font-semibold mt-1">👥 +${asset.protectedPopulation.toLocaleString()} residents protected</div>
            <div class="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-200">
              <span>Status: <b class="text-emerald-600 uppercase">${asset.status}</b></span>
              <span>Dispatched: ${asset.dispatchedAt}</span>
            </div>
            <div class="text-amber-700 text-[10px] font-semibold mt-1">👉 Click to view unit deployment actions & tract details</div>
          </div>`,
          { direction: 'top', offset: [0, -10] }
        );

        marker.on('click', () => {
          setSelectedAsset(asset);
          if (asset.tractId) {
            const tract = tracts.find((t) => t.geoId === asset.tractId);
            if (tract) {
              onSelectTract(tract);
            }
          }
        });

        layerGroupRef.current?.addLayer(marker);
      });
    }
  }, [
    tracts,
    selectedTract,
    minOffsetFilter,
    minPovertyFilter,
    showWalkBuffers,
    onlyCandidates,
    onlyWellnessPriority,
    canopyFilter,
    bivariateLens,
    showDispatchedAssets,
    dispatchedAssets,
    activeMetric,
    getColor,
    onSelectTract,
  ]);

  // Sync map center when selectedTract changes from external interactions
  useEffect(() => {
    if (selectedTract && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([selectedTract.latitude, selectedTract.longitude], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [selectedTract]);

  return (
    <div className="relative w-full h-[calc(100vh-8.5rem)] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col md:flex-row">
      {/* Top Search & Filter Bar */}
      <div className="absolute top-4 left-4 z-[400] w-80 sm:w-[440px] max-w-[calc(100vw-2rem)] space-y-2">
        {/* Metric Layer Switcher */}
        <div className="bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-xl shadow-2xl p-2 space-y-1.5">
          {/* Header */}
          <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Map Metric Choropleth
            </span>
            <span className="text-[9px] font-mono text-slate-500 font-normal">Active Layer</span>
          </div>

          {/* Primary Thermal & Vulnerability Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveMetric('heat')}
              className={`min-w-0 flex items-center justify-center gap-2 py-2 px-2.5 rounded-md font-bold transition-all cursor-pointer text-center ${
                activeMetric === 'heat'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60 ring-1 ring-rose-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Predicted Heat Offset (°F) — Microclimate thermal elevation above baseline"
            >
              <span className="text-base shrink-0">🌡️</span>
              <div className="min-w-0 text-left sm:text-center leading-tight">
                <div className="text-[11px] font-bold truncate">Predicted Heat Offset</div>
                <div className={`text-[10px] font-mono ${activeMetric === 'heat' ? 'text-rose-100' : 'text-slate-500'}`}>
                  (°F Elevation)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveMetric('integratedRisk')}
              className={`min-w-0 flex items-center justify-center gap-2 py-2 px-2.5 rounded-md font-bold transition-all cursor-pointer text-center ${
                activeMetric === 'integratedRisk'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/60 ring-1 ring-indigo-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Multi-Criteria Integrated Risk (0-100) — Composite heat, SVI, density, and access score"
            >
              <span className="text-base shrink-0">🛡️</span>
              <div className="min-w-0 text-left sm:text-center leading-tight">
                <div className="text-[11px] font-bold truncate">Multi-Criteria Risk</div>
                <div className={`text-[10px] font-mono ${activeMetric === 'integratedRisk' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  Integrated (0–100)
                </div>
              </div>
            </button>
          </div>

          {/* Secondary Nature-Based Solutions & Shade Equity Layers */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/70">
            <button
              type="button"
              onClick={() => setActiveMetric('canopy')}
              className={`min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-semibold text-[10.5px] transition-all cursor-pointer ${
                activeMetric === 'canopy'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-950/50 ring-1 ring-emerald-400/40'
                  : 'bg-slate-950/50 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800/60'
              }`}
              title="LiDAR Tree Canopy Coverage (%)"
            >
              <span className="shrink-0 text-xs">🌳</span>
              <span className="truncate">Canopy Cover (%)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMetric('canopyDeficit')}
              className={`min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-semibold text-[10.5px] transition-all cursor-pointer ${
                activeMetric === 'canopyDeficit'
                  ? 'bg-amber-600 text-white shadow shadow-amber-950/50 ring-1 ring-amber-400/40'
                  : 'bg-slate-950/50 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800/60'
              }`}
              title="Shade Deficit (% Gap vs 50% City Target)"
            >
              <span className="shrink-0 text-xs">🎯</span>
              <span className="truncate">Shade Deficit (% Gap)</span>
            </button>
          </div>
        </div>

        {/* Landmark / Neighborhood Search */}
        <div className="relative bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-xl shadow-2xl p-1.5">
          <div className="flex items-center px-2 py-1 space-x-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search neighborhood, street, or tract..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/98 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1.5 border-b border-slate-800 bg-slate-950/50">
                Matching Atlanta Tracts ({searchResults.length})
              </div>
              {searchResults.map((tract) => (
                <button
                  key={tract.geoId}
                  type="button"
                  onClick={() => handleSelectAndFly(tract)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/80 border-b border-slate-800/40 flex items-center justify-between text-xs transition-colors"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-200 block truncate">{tract.neighborhood}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Tract {tract.geoId} · Canopy {tract.treeCanopyPct ?? '--'}%</span>
                  </div>
                  <span
                    className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                      tract.predictedOffsetF >= 3.5
                        ? 'bg-rose-500/20 text-rose-400'
                        : tract.predictedOffsetF >= 1.0
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {tract.predictedOffsetF > 0 ? `+${tract.predictedOffsetF}°F` : `${tract.predictedOffsetF}°F`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spatial Heat & Walk Filters Panel */}
        <div
          className={`bg-slate-900/90 backdrop-blur border border-slate-700/70 rounded-xl shadow-xl hidden sm:block transition-all duration-200 ${
            isFiltersMinimized ? 'p-2.5' : 'p-3 max-h-[60vh] overflow-y-auto modal-scroll-container'
          }`}
        >
          {/* Panel Header & Minimize/Expand Controls */}
          <div className={`flex items-center justify-between ${!isFiltersMinimized ? 'mb-2 pb-1.5 border-b border-slate-800' : ''}`}>
            <button
              type="button"
              onClick={() => setIsFiltersMinimized(!isFiltersMinimized)}
              className="flex items-center space-x-2 text-left focus:outline-none group flex-1 cursor-pointer"
              title={isFiltersMinimized ? "Expand filters & legend" : "Minimize filters & legend"}
            >
              <SlidersHorizontal className="w-4 h-4 text-rose-400 group-hover:text-rose-300 transition-colors" />
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Spatial Filters & Legend
                </h4>
                {activeFilterCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
            </button>
            <div className="flex items-center space-x-1">
              {activeFilterCount > 0 && !isFiltersMinimized && (
                <button
                  type="button"
                  onClick={() => {
                    setMinOffsetFilter(-3);
                    setMinPovertyFilter(0);
                    setOnlyCandidates(false);
                    setOnlyWellnessPriority(false);
                    setCanopyFilter('all');
                    setBivariateLens(false);
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-300 underline mr-1 px-1 transition-colors cursor-pointer"
                  title="Reset filters to defaults"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFiltersMinimized(!isFiltersMinimized)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                aria-label={isFiltersMinimized ? "Expand filters" : "Minimize filters"}
                title={isFiltersMinimized ? "Expand filters" : "Minimize filters"}
              >
                {isFiltersMinimized ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {!isFiltersMinimized && (
            <>
              <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Min Offset:</span>
                <span className="font-mono font-bold text-rose-400">
                  {minOffsetFilter > 0 ? `+${minOffsetFilter}°F` : `${minOffsetFilter}°F`}
                </span>
              </div>
              <input
                type="range"
                min="-3"
                max="4.5"
                step="0.5"
                value={minOffsetFilter}
                onChange={(e) => setMinOffsetFilter(parseFloat(e.target.value))}
                className="w-full accent-rose-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Min Poverty Rate:</span>
                <span className="font-mono font-bold text-amber-400">{minPovertyFilter}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="45"
                step="5"
                value={minPovertyFilter}
                onChange={(e) => setMinPovertyFilter(parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWalkBuffers}
                    onChange={(e) => setShowWalkBuffers(e.target.checked)}
                    className="rounded accent-sky-500 text-sky-500"
                  />
                  <span>10-min Walk Buffers</span>
                </label>

                <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyCandidates}
                    onChange={(e) => setOnlyCandidates(e.target.checked)}
                    className="rounded accent-rose-500 text-rose-500"
                  />
                  <span>Siting Sites Only</span>
                </label>
              </div>

              {/* Dedicated Senior & Disability Wellness Priority Zones Layer */}
              <div className="pt-1 border-t border-slate-800/60">
                <label className="flex items-start space-x-1.5 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyWellnessPriority}
                    onChange={(e) => setOnlyWellnessPriority(e.target.checked)}
                    className="rounded accent-rose-500 text-rose-500 mt-0.5"
                  />
                  <div className="leading-tight">
                    <span className="font-medium text-rose-300 flex items-center gap-1">
                      <span>🛡️</span>
                      <span>Senior & Disability Wellness Priority Zones</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Elderly living alone ≥18% or disability ≥15% ({wellnessTractsCount} tracts flagged)
                    </span>
                  </div>
                </label>
              </div>

              {/* Mobile Fleet Units Toggle */}
              <div className="pt-1 space-y-1 border-t border-slate-800/60">
                <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDispatchedAssets}
                    onChange={(e) => setShowDispatchedAssets(e.target.checked)}
                    className="rounded accent-emerald-500 text-emerald-500"
                  />
                  <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                    <Truck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mobile Fleet Units ({dispatchedAssets.length})</span>
                  </span>
                </label>
              </div>

              {/* Canopy Coverage Deficit Filter */}
              <div className="pt-1.5 border-t border-slate-800/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <Trees className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Canopy Coverage Filter:</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCanopyFilter('all')}
                    className={`py-1 px-1 rounded text-[10px] font-medium transition-colors text-center cursor-pointer ${
                      canopyFilter === 'all'
                        ? 'bg-slate-700 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Tracts
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanopyFilter('belowMedian')}
                    className={`py-1 px-1 rounded text-[10px] font-medium transition-colors text-center cursor-pointer ${
                      canopyFilter === 'belowMedian'
                        ? 'bg-amber-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Canopy below cohort median (< 37.16%)"
                  >
                    &lt; 37.16%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanopyFilter('critical')}
                    className={`py-1 px-1 rounded text-[10px] font-medium transition-colors text-center cursor-pointer ${
                      canopyFilter === 'critical'
                        ? 'bg-rose-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Critical Shelter Deficit (< 20%)"
                  >
                    &lt; 20% Crit
                  </button>
                </div>
              </div>

              {/* Bivariate Acute Lens Toggle */}
              <div className="pt-1.5 border-t border-slate-800/60">
                <label className="flex items-start space-x-1.5 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bivariateLens}
                    onChange={(e) => setBivariateLens(e.target.checked)}
                    className="rounded accent-rose-500 text-rose-500 mt-0.5"
                  />
                  <div className="leading-tight flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-300 flex items-center gap-1 text-[11px]">
                        <span>🔬</span>
                        <span>Bivariate Acute Lens</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                        {bivariateHotspotsCount} Flagged
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Heat &gt; +3.5°F &amp; Canopy &lt; 30%
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Dynamic Active Metric Choropleth Map Legend */}
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-300 font-bold">{legendConfig.title}:</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  {activeMetric}
                </span>
              </div>
              <div className="space-y-1">
                {legendConfig.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[10px] text-slate-300">
                    <span className="truncate pr-1">{item.label}</span>
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-slate-700"
                      style={{ backgroundColor: item.color }}
                    ></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Fleet Units Legend Breakdown */}
            <div className="pt-2 border-t border-slate-800/70 space-y-1 text-[10px]">
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">
                Asset & Siting Key:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🏛️</span>
                  <span>Cooling Site</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border border-sky-400 bg-sky-500/20 inline-block"></span>
                  <span>10-min Walk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">💧</span>
                  <span>Hydration Trailer</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🚑</span>
                  <span>Wellness Van</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <span className="text-xs">🚌</span>
                  <span>MARTA Shelter Bus (68°F)</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  </div>

      {/* Main Map Canvas */}
      <div className="flex-1 h-full relative" onClick={() => setIsSearchFocused(false)}>
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Selected Dispatched Mobile Fleet Asset Floating Inspector */}
        {selectedAsset && (
          <div className="absolute top-4 right-4 z-20 max-w-sm w-full bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-xl p-4 shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-base">
                  {selectedAsset.type === 'hydration' ? '🚚💧' : selectedAsset.type === 'wellness' ? '🚚🚑' : '🚌'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white leading-tight">{selectedAsset.name}</h4>
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wide">
                    {selectedAsset.type === 'hydration'
                      ? 'Mobile Fleet • Potable Hydration Payload'
                      : selectedAsset.type === 'wellness'
                      ? 'Mobile Fleet • Paramedic Triage Payload'
                      : 'Transit Bus • Cooling Shelter Payload'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Dismiss Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center bg-slate-950/70 px-2.5 py-1.5 rounded-md border border-slate-800/80">
                <span className="text-slate-400">Deployed Station:</span>
                <span className="font-semibold text-slate-100">{selectedAsset.locationName}</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950/70 px-2.5 py-1.5 rounded-md border border-slate-800/80">
                <span className="text-slate-400">Vehicle Carrier:</span>
                <span className="font-mono text-emerald-400">🚚 Class-6 Rapid Deployment Truck</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950/70 px-2.5 py-1.5 rounded-md border border-slate-800/80">
                <span className="text-slate-400">Mission Payload:</span>
                <span className="font-medium text-amber-300">
                  {selectedAsset.type === 'hydration'
                    ? '💧 1,000-gal Chilled Potable Reservoir'
                    : selectedAsset.type === 'wellness'
                    ? '🚑 Mobile Paramedic Ice-Vest Unit'
                    : '🚌 Air-Conditioned High-Capacity Cabin'}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-950/70 px-2.5 py-1.5 rounded-md border border-slate-800/80">
                <span className="text-slate-400">Protected Population:</span>
                <span className="font-mono font-bold text-sky-400">+{selectedAsset.protectedPopulation.toLocaleString()} residents</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950/70 px-2.5 py-1.5 rounded-md border border-slate-800/80">
                <span className="text-slate-400">Status & Timestamp:</span>
                <span className="text-emerald-400 font-semibold">{selectedAsset.status.toUpperCase()} ({selectedAsset.dispatchedAt})</span>
              </div>
            </div>

            {/* Asset Operations */}
            <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center gap-2">
              {selectedAsset.tractId && (
                <button
                  type="button"
                  onClick={() => {
                    const assignedTract = tracts.find((t) => t.geoId === selectedAsset.tractId);
                    if (assignedTract) {
                      onSelectTract(assignedTract);
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.flyTo([assignedTract.latitude, assignedTract.longitude], 14, { duration: 0.8 });
                      }
                    }
                  }}
                  className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition-colors text-center"
                >
                  Inspect Tract
                </button>
              )}

              {onRecallAsset && (
                <button
                  type="button"
                  onClick={() => {
                    onRecallAsset(selectedAsset.id);
                    setSelectedAsset(null);
                  }}
                  className="flex-1 py-1.5 px-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded text-[11px] font-medium transition-colors text-center"
                >
                  Recall Unit
                </button>
              )}

              {onSwitchToDecisions && (
                <button
                  type="button"
                  onClick={() => onSwitchToDecisions()}
                  className="py-1.5 px-2.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 rounded text-[11px] font-medium transition-colors text-center"
                  title="Open Dispatch & Decisions Panel"
                >
                  Dispatch Ops
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Selected Tract Inspector Drawer */}
      {selectedTract ? (
        <div className="w-full md:w-96 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-5 overflow-y-auto flex flex-col justify-between z-20 modal-scroll-container">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-slate-400">TRACT {selectedTract.geoId}</span>
                <h3 className="text-base font-bold text-white leading-tight">{selectedTract.neighborhood}</h3>
                {isWellnessPriority(selectedTract) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 mt-1">
                    🛡️ Senior & Disability Priority
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  title="Focus on Map"
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo([selectedTract.latitude, selectedTract.longitude], 14, { duration: 0.8 });
                    }
                  }}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Crosshair className="w-4 h-4" />
                </button>
                <span
                  className={`px-2 py-1 rounded text-xs font-bold font-mono ${
                    selectedTract.predictedOffsetF >= 3.5
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : selectedTract.predictedOffsetF >= 1.0
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {selectedTract.predictedOffsetF > 0 ? `+${selectedTract.predictedOffsetF}°F` : `${selectedTract.predictedOffsetF}°F`}
                </span>
              </div>
            </div>

            {/* Multi-Criteria Integrated Risk Score Card (Interactive Layer Switcher) */}
            <div
              onClick={() => setActiveMetric('integratedRisk')}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                activeMetric === 'integratedRisk'
                  ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-950/50'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-slate-200">Integrated Risk Score</span>
                  {activeMetric === 'integratedRisk' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                      Active Map Layer
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openGlossary('multi-criteria-formula');
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded"
                  title="View Integrated Risk Formula in Glossary"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex justify-between items-baseline mt-2">
                <div>
                  <span className="text-[11px] text-slate-400">Integrated Index: </span>
                  <span className="font-mono text-indigo-400 text-lg font-bold">
                    {selectedTract.integratedRiskScore !== undefined ? selectedTract.integratedRiskScore.toFixed(1) : 'N/A'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono"> / 100</span>
                </div>
                {selectedTract.integratedRiskScore !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      selectedTract.integratedRiskScore >= 80
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : selectedTract.integratedRiskScore >= 60
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                        : selectedTract.integratedRiskScore >= 40
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {selectedTract.integratedRiskScore >= 80
                      ? 'Critical'
                      : selectedTract.integratedRiskScore >= 60
                      ? 'High'
                      : selectedTract.integratedRiskScore >= 40
                      ? 'Moderate'
                      : 'Low'}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                25% Heat · 25% SVI · 20% Density · 15% Facility · 15% Transit • Click to color map
              </div>
            </div>

            {/* Localized Temperature Calculator / Microclimate Offset Card (Interactive Layer Switcher) */}
            <div
              onClick={() => setActiveMetric('heat')}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                activeMetric === 'heat'
                  ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/50 shadow-lg shadow-rose-950/50'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-slate-200">Microclimate Thermal Offset</span>
                  {activeMetric === 'heat' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-300 border border-rose-500/40">
                      Active Map Layer
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openGlossary('thermal-offset');
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded"
                  title="View Thermal Offset definition in Glossary"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex justify-between items-baseline mt-2">
                <div>
                  <span className="text-[11px] text-slate-400">Localized Reading: </span>
                  <span className="font-mono text-rose-400 text-lg font-bold">
                    {(forecastBaselineF + selectedTract.predictedOffsetF).toFixed(1)}°F
                  </span>
                </div>
                <span className="font-mono font-bold text-sm text-slate-200">
                  {selectedTract.predictedOffsetF > 0 ? `+${selectedTract.predictedOffsetF}°F` : `${selectedTract.predictedOffsetF}°F`}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Baseline {forecastBaselineF}°F • Click card to color map by Heat Offset
              </div>
            </div>

            {/* Tree Canopy & Shade Equity Card (Progress towards 50% City Target) */}
            {selectedCanopyMetrics && (
              <div
                onClick={() => setActiveMetric(activeMetric === 'canopy' ? 'canopyDeficit' : 'canopy')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                  activeMetric === 'canopy' || activeMetric === 'canopyDeficit'
                    ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-950/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <Trees className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-slate-200">Tree Canopy &amp; Shade Equity</span>
                    {(activeMetric === 'canopy' || activeMetric === 'canopyDeficit') && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                        Active: {activeMetric === 'canopy' ? 'Canopy %' : 'Deficit Gap'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGlossary('explainability-ai-attribution');
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded"
                    title="Canopy details in Glossary"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Canopy Level & 50% Target */}
                <div className="flex justify-between items-baseline mt-2">
                  <div>
                    <span className="text-[11px] text-slate-400">Current Canopy: </span>
                    <span className="font-mono text-emerald-400 text-lg font-bold">
                      {selectedCanopyMetrics.treeCanopyPct}%
                    </span>
                    <span className="text-xs text-slate-400 font-mono"> / 50% Target</span>
                  </div>
                  <span className="font-mono font-bold text-xs text-amber-400">
                    Gap: -{selectedCanopyMetrics.targetGapPct}%
                  </span>
                </div>

                {/* Progress bar towards 50% City Target */}
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Progress towards 50% City Target</span>
                    <span className="font-mono font-semibold">
                      {((selectedCanopyMetrics.treeCanopyPct / CITYWIDE_CANOPY_TARGET_PCT) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="canopy-progress-bar">
                    <div
                      className="canopy-progress-fill"
                      style={{ width: `${Math.min(100, (selectedCanopyMetrics.treeCanopyPct / CITYWIDE_CANOPY_TARGET_PCT) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Plantable ROW and Marginal Planting Cost */}
                <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-800 text-[11px]">
                  <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Plantable ROW:</span>
                    <span className="font-mono font-bold text-slate-200">
                      {(selectedTract.plantableRowSqm ?? selectedCanopyMetrics?.plantableRowSqm ?? 12500).toLocaleString()} m²
                    </span>
                  </div>
                  <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Marginal Cost:</span>
                    <span className="font-mono font-bold text-emerald-300">
                      ${selectedTract.marginalPlantingCost ?? selectedCanopyMetrics?.marginalPlantingCost ?? 650}/tree
                    </span>
                  </div>
                </div>

                {/* Multi-Departmental Co-Funding Eligibility Tags */}
                <div className="mt-2.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Co-Funding Eligibility ($1,500 Split):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                        selectedCanopyMetrics.isParksEligible
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-900/80 text-slate-500 border-slate-800 opacity-60'
                      }`}
                      title="Office of Parks: Canopy < 37.16% cohort median"
                    >
                      <span>🌳 Parks</span>
                      <span>({selectedCanopyMetrics.isParksEligible ? 'Eligible' : '<37.16% req'})</span>
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                        selectedCanopyMetrics.isWatershedEligible
                          ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-900/80 text-slate-500 border-slate-800 opacity-60'
                      }`}
                      title="Watershed: Pop Density > 5,141.4 / sq mi"
                    >
                      <span>💧 Watershed</span>
                      <span>({selectedCanopyMetrics.isWatershedEligible ? 'Eligible' : '>5.1k pop req'})</span>
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                        selectedCanopyMetrics.isResilienceEligible
                          ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/50'
                          : 'bg-slate-900/80 text-slate-500 border-slate-800 opacity-60'
                      }`}
                      title="Resilience: SVI > 0.50 equity priority"
                    >
                      <span>🛡️ Resilience</span>
                      <span>({selectedCanopyMetrics.isResilienceEligible ? 'Eligible' : '>0.50 SVI req'})</span>
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 mt-2 flex items-center justify-between">
                  <span>👉 Click card to color map by Canopy % / Deficit Gap</span>
                </div>
              </div>
            )}

            {/* CDC SVI Percentile Card */}
            <div
              onClick={() => setActiveMetric('svi')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeMetric === 'svi'
                  ? 'bg-purple-950/40 border-purple-400 ring-2 ring-purple-400/50 shadow-lg'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-purple-300 mb-1">
                <div className="flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-semibold">CDC SVI (Social Vulnerability Index)</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openGlossary('cdc-svi');
                  }}
                  className="text-purple-400/70 hover:text-white"
                  title="CDC SVI definition in Glossary"
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <div className="text-base font-bold text-white font-mono">
                  {selectedTract.sviScore !== undefined ? selectedTract.sviScore.toFixed(2) : '0.85'}
                  <span className="text-xs text-slate-400 font-sans font-normal"> / 1.00</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {sviRankInfo ? `#${sviRankInfo.rank} of ${sviRankInfo.total}` : 'Composite Score'}
                </span>
              </div>
              {activeMetric === 'svi' && (
                <div className="text-[9px] font-bold text-purple-300 mt-1">Active Map Layer</div>
              )}
            </div>

            {/* Socioeconomic Vulnerability Grid (Interactive Layer Switchers) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Poverty Rate Card */}
              <div
                onClick={() => setActiveMetric('poverty')}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  activeMetric === 'poverty'
                    ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
                    : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <div className="flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-semibold text-slate-200">Poverty Rate</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGlossary('poverty-vehicle-deficit');
                    }}
                    className="text-slate-400 hover:text-white"
                    title="Poverty Thresholds in Glossary"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-base font-bold text-slate-100 font-mono">
                  {selectedTract.povertyRatePct}%
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400">P75: 24.5%</span>
                  {activeMetric === 'poverty' && (
                    <span className="text-[9px] font-bold text-amber-400">Active</span>
                  )}
                </div>
              </div>

              {/* Zero Vehicle Households Card */}
              <div
                onClick={() => setActiveMetric('noVehicle')}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  activeMetric === 'noVehicle'
                    ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400/50 shadow-lg'
                    : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <div className="flex items-center space-x-1.5">
                    <Navigation className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-semibold text-slate-200">No Vehicle</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGlossary('poverty-vehicle-deficit');
                    }}
                    className="text-slate-400 hover:text-white"
                    title="Vehicle Deficit in Glossary"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-base font-bold text-slate-100 font-mono">
                  {selectedTract.noVehicleRatePct}%
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400">P75: 14.8%</span>
                  {activeMetric === 'noVehicle' && (
                    <span className="text-[9px] font-bold text-cyan-300">Active</span>
                  )}
                </div>
              </div>
            </div>

            {/* Senior & Disability Demographics Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Seniors Living Alone Card (Interactive Layer Switcher for Seniors) */}
              <div
                onClick={() => setActiveMetric('seniors')}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  activeMetric === 'seniors'
                    ? 'bg-rose-950/40 border-rose-400 ring-2 ring-rose-400/50 shadow-lg'
                    : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-rose-400" />
                    <span className="font-semibold text-slate-200">Seniors Alone</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGlossary('wellness-check-thresholds');
                    }}
                    className="text-slate-400 hover:text-white"
                    title="Senior Isolation Thresholds in Glossary"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-base font-bold text-rose-300 font-mono">
                  {selectedTract.seniorsLivingAlonePct !== undefined ? `${selectedTract.seniorsLivingAlonePct}%` : '21.4%'}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400">Threshold: ≥18%</span>
                  {activeMetric === 'seniors' && (
                    <span className="text-[9px] font-bold text-rose-300">Active</span>
                  )}
                </div>
              </div>

              {/* Disability Rate Card */}
              <div
                onClick={() => setActiveMetric('seniors')}
                className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/60 hover:border-slate-600 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <div className="flex items-center space-x-1.5">
                    <HeartHandshake className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-semibold text-slate-200">Disability Rate</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGlossary('wellness-check-thresholds');
                    }}
                    className="text-slate-400 hover:text-white"
                    title="Disability Threshold in Glossary"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-base font-bold text-indigo-300 font-mono">
                  {selectedTract.disabilityRatePct !== undefined ? `${selectedTract.disabilityRatePct}%` : '16.8%'}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400">Threshold: ≥15%</span>
                  <span className="text-[10px] text-slate-400">Age: {selectedTract.medianAge}y</span>
                </div>
              </div>
            </div>

            {/* Quick Action: Dispatch Wellness Van to Tract */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-rose-400" />
                  <span>Proactive Wellness Dispatch</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Mobile Surge Unit</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Send emergency paramedics and ice vests to verify vulnerable elderly/isolated residents in this tract.
              </p>
              <button
                type="button"
                onClick={handleDispatchWellnessVanToSelected}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow shadow-indigo-950/50 cursor-pointer"
              >
                <span>🚑 Dispatch Wellness Van to Tract</span>
              </button>
              {dispatchFeedback && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-800/40">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{dispatchFeedback}</span>
                </div>
              )}
            </div>

            {/* Existing / Recommended Cooling Center Status */}
            {selectedTract.hasCoolingCenter && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs">
                <div className="font-bold text-emerald-300 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Identified Cooling Siting Candidate</span>
                </div>
                <p className="text-slate-300 mt-1 font-semibold">{selectedTract.coolingCenterName}</p>
                <div className="flex items-center justify-between text-slate-400 text-[11px] mt-1 pt-1 border-t border-emerald-900/40">
                  <span>Type: {selectedTract.coolingCenterType}</span>
                  <span>10-min Walk Score: {selectedTract.walkScore}/100</span>
                </div>
              </div>
            )}
          </div>

          {/* Action CTA: Consult AI Advisor */}
          <div className="pt-3 border-t border-slate-800 mt-4">
            <button
              onClick={() => onAskAgentAboutTract(selectedTract)}
              className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-medium text-xs flex items-center justify-center space-x-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Query Advisor on {selectedTract.neighborhood}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex w-80 bg-slate-900 border-l border-slate-800 p-6 flex-col items-center justify-center text-center text-slate-500">
          <Info className="w-10 h-10 mb-3 text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-400">Click Any Census Tract</h4>
          <p className="text-xs text-slate-500 mt-1">
            Search above or click any point on the Atlanta map to inspect microclimate heat offsets, tree canopy %, SVI vulnerability, and 10-minute walk buffers.
          </p>
        </div>
      )}
    </div>
  );
};
