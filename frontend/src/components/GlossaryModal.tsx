import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, X, Search, ShieldAlert, Sparkles, Truck, Flame, HelpCircle } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { GLOSSARY_ITEMS, GlossaryItem } from '../services/glossaryData';

type CategoryTab = 'All' | 'Heat Metrics' | 'Equity Indices' | 'Mobile Assets' | 'Explainable AI';

export const GlossaryModal: React.FC = () => {
  const { isGlossaryOpen, glossaryTopic, closeGlossary } = useUI();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTab>('All');

  const { modalRef, handleBackdropClick } = useModalDismiss({
    isOpen: isGlossaryOpen,
    onClose: closeGlossary,
  });

  // When opened with a specific topic, set search or active item
  useEffect(() => {
    if (glossaryTopic) {
      const normalized = glossaryTopic.replace(/_/g, '-').toLowerCase();
      const matched = GLOSSARY_ITEMS.find(
        (item) => item.id.toLowerCase() === normalized || item.id.toLowerCase().includes(normalized)
      );
      if (matched) {
        setSearchQuery(matched.term);
        // Switch tab to category
        if (matched.category === 'Climate & Heat') setActiveTab('Heat Metrics');
        else if (matched.category === 'Vulnerability & Demographics') setActiveTab('Equity Indices');
        else if (matched.category === 'Operations & Logistics') setActiveTab('Mobile Assets');
        else if (matched.category === 'Explainable AI') setActiveTab('Explainable AI');
      } else {
        setSearchQuery(glossaryTopic.replace(/_/g, ' '));
      }
    } else {
      setSearchQuery('');
      setActiveTab('All');
    }
  }, [glossaryTopic, isGlossaryOpen]);

  // Tab mapping to internal category
  const categoryMap: Record<CategoryTab, string | null> = {
    'All': null,
    'Heat Metrics': 'Climate & Heat',
    'Equity Indices': 'Vulnerability & Demographics',
    'Mobile Assets': 'Operations & Logistics',
    'Explainable AI': 'Explainable AI',
  };

  const filteredItems = useMemo(() => {
    let list = GLOSSARY_ITEMS;

    // Filter by tab
    const targetCategory = categoryMap[activeTab];
    if (targetCategory) {
      list = list.filter((item) => item.category === targetCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.term.toLowerCase().includes(q) ||
          item.shortDefinition.toLowerCase().includes(q) ||
          item.detailedExplanation.toLowerCase().includes(q) ||
          item.operationalApplication.toLowerCase().includes(q) ||
          (item.formulaOrStandard && item.formulaOrStandard.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeTab, searchQuery]);

  if (!isGlossaryOpen) return null;

  const getCategoryBadge = (category: GlossaryItem['category']) => {
    switch (category) {
      case 'Climate & Heat':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Flame className="w-3 h-3" /> Heat Metric
          </span>
        );
      case 'Vulnerability & Demographics':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-3 h-3" /> Equity Index
          </span>
        );
      case 'Operations & Logistics':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Truck className="w-3 h-3" /> Mobile Asset
          </span>
        );
      case 'Explainable AI':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-3 h-3" /> Explainable AI
          </span>
        );
    }
  };

  const tabs: CategoryTab[] = ['All', 'Heat Metrics', 'Equity Indices', 'Mobile Assets', 'Explainable AI'];

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      >
        {/* Pinned Header */}
        <div className="p-5 border-b border-slate-800 shrink-0 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h3 id="glossary-modal-title" className="font-bold text-white text-base">
                Urban Heat & Equity Glossary
              </h3>
              <p className="text-xs text-slate-400">
                Plain-English reference guide for municipal indices, thermal metrics, and mobile fleet assets
              </p>
            </div>
          </div>
          <button
            onClick={closeGlossary}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close glossary modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Tabs Controls */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search definitions, standards, data sources (e.g. SVI, thermal offset, walkshed)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 modal-scroll-container">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No matching terms found</p>
              <p className="text-xs text-slate-500">
                Try searching for "SVI", "heat", "walk", "canopy", or clear the filter.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('All');
                }}
                className="mt-2 text-xs text-indigo-400 hover:underline font-medium"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{item.term}</span>
                  </h4>
                  <div>{getCategoryBadge(item.category)}</div>
                </div>

                <p className="text-xs font-medium text-slate-200 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                  {item.shortDefinition}
                </p>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {item.detailedExplanation}
                </p>

                {item.formulaOrStandard && (
                  <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 text-[11px] font-mono text-emerald-300">
                    <span className="text-slate-400 block font-sans font-bold text-[10px] uppercase tracking-wider mb-0.5">
                      Operational Formula / Standard:
                    </span>
                    {item.formulaOrStandard}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                  <div className="text-slate-400">
                    <strong className="text-slate-300">Application: </strong>
                    {item.operationalApplication}
                  </div>
                </div>

                {item.dataSources.length > 0 && (
                  <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="font-semibold text-slate-400">Sources:</span>
                    {item.dataSources.map((ds, idx) => (
                      <span key={idx} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {ds}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pinned Footer */}
        <div className="p-4 border-t border-slate-800 shrink-0 flex items-center justify-between bg-slate-900/95">
          <span className="text-xs text-slate-400">
            Showing {filteredItems.length} of {GLOSSARY_ITEMS.length} defined resilience terms
          </span>
          <button
            onClick={closeGlossary}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlossaryModal;
