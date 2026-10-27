import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface UIContextType {
  // Glossary Modal
  isGlossaryOpen: boolean;
  glossaryTopic: string | null;
  openGlossary: (topic?: string) => void;
  closeGlossary: () => void;

  // Executive Council Memo Modal
  isCouncilMemoOpen: boolean;
  councilMemoData: any;
  openCouncilMemo: (customData?: any) => void;
  closeCouncilMemo: () => void;

  // Active Choropleth Layer / Map Metric
  activeChoroplethMetric: string;
  setActiveChoroplethMetric: (metric: string) => void;
}

export interface UIProviderProps {
  children: React.ReactNode;
  initialChoroplethMetric?: string;
}

export const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<UIProviderProps> = ({
  children,
  initialChoroplethMetric = 'offset',
}) => {
  // Glossary Modal state
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);
  const [glossaryTopic, setGlossaryTopic] = useState<string | null>(null);

  // Council Memo Modal state
  const [isCouncilMemoOpen, setIsCouncilMemoOpen] = useState<boolean>(false);
  const [councilMemoData, setCouncilMemoData] = useState<any>(null);

  // Active choropleth metric state
  const [activeChoroplethMetric, setActiveChoroplethMetric] = useState<string>(initialChoroplethMetric);

  const openGlossary = useCallback((topic?: string) => {
    setGlossaryTopic(topic ?? null);
    setIsGlossaryOpen(true);
  }, []);

  const closeGlossary = useCallback(() => {
    setIsGlossaryOpen(false);
  }, []);

  const openCouncilMemo = useCallback((customData?: any) => {
    if (customData !== undefined) {
      setCouncilMemoData(customData);
    }
    setIsCouncilMemoOpen(true);
  }, []);

  const closeCouncilMemo = useCallback(() => {
    setIsCouncilMemoOpen(false);
  }, []);

  const value = useMemo<UIContextType>(
    () => ({
      isGlossaryOpen,
      glossaryTopic,
      openGlossary,
      closeGlossary,
      isCouncilMemoOpen,
      councilMemoData,
      openCouncilMemo,
      closeCouncilMemo,
      activeChoroplethMetric,
      setActiveChoroplethMetric,
    }),
    [
      isGlossaryOpen,
      glossaryTopic,
      openGlossary,
      closeGlossary,
      isCouncilMemoOpen,
      councilMemoData,
      openCouncilMemo,
      closeCouncilMemo,
      activeChoroplethMetric,
      setActiveChoroplethMetric,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

export default UIContext;
