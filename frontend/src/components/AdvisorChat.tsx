import React, { useState, useRef, useEffect } from 'react';
import { agentApi } from '../services/agentApi';
import { rankingEvidence } from '../services/agentEvidence';
import { RecommendationCards } from './RecommendationCards';
import { ChatMessage } from '../types';
import { Send, Bot, User, Sparkles, Terminal, ChevronDown, ChevronRight, Clock } from 'lucide-react';

interface AdvisorChatProps {
  useMockMode: boolean;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

export const AdvisorChat: React.FC<AdvisorChatProps> = ({
  useMockMode,
  initialPrompt,
  onClearInitialPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Hello! I am the **Atlanta Heat Resilience Advisor**, powered by Google Agent Development Kit (ADK), Gemini 2.5 Flash, and BigQuery ML.

I am calibrated for municipal decision-makers in the City of Atlanta to:
- Predict campaign-relative heat offsets and explain model associations (\`ML.EXPLAIN_PREDICT\`)
- Optimize candidate cooling center locations
- Audit climate equity against Atlanta 75th percentile thresholds
- Analyze GHCN daily extreme heat trends.

Select one of the preset planner questions below or enter a custom prompt.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'gemini-2.5-flash',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [openToolTraceId, setOpenToolTraceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle external trigger (e.g. from map or ranking)
  useEffect(() => {
    if (initialPrompt) {
      handleSendMessage(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt]);

  const plannerQuestions = [
    {
      label: 'Siting Recommendations',
      icon: '🎯',
      query: 'We have funding for 3 cooling centers. Where should they go?',
    },
    {
      label: 'Explain Disparities',
      icon: '🔍',
      query: 'Why is South Pryor St hotter than Piedmont Park?',
    },
    {
      label: 'Historical Heat Trends',
      icon: '📈',
      query: 'How often does Atlanta hit 95°F? Is it getting worse?',
    },
    {
      label: 'Neighborhood Demographics',
      icon: '👥',
      query: 'Who lives around South Pryor St (Tract 13121006802)?',
    },
    {
      label: 'Compare Tract Tradeoffs',
      icon: '⚖️',
      query: 'Compare Census Tract 13121006802 versus Tract 13121007808.',
    },
    {
      label: 'Draft Council Memo',
      icon: '📝',
      query: 'Draft the formal proposal for Atlanta City Council recommending cooling centers.',
    },
    {
      label: 'Audit Climate Equity',
      icon: '🛡️',
      query: 'Audit the equity of cooling centers in tracts 13121006802, 13121007808, and 13121002200.',
    },
    {
      label: 'Co-Funding Eligibility',
      icon: '🌳',
      query: 'Which tracts qualify for Parks & Resilience co-funding for street trees?',
    },
    {
      label: 'SW Atlanta Canopy Audit',
      icon: '🌿',
      query: 'Audit the canopy deficit in Southwest Atlanta transit corridors.',
    },
    {
      label: 'ROW Planting Ordinance',
      icon: '📜',
      query: 'Draft an ordinance to fund right-of-way planting in heat island corridors.',
    },
    {
      label: '50% Canopy Target Siting',
      icon: '🎯',
      query: 'Recommend top right-of-way street tree planting locations under the 50% canopy target.',
    },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const res = await agentApi.runAgent(query, { useMockFallback: useMockMode });

      const assistantMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-reply',
        role: 'assistant',
        content: res.responseText,
        toolCalls: res.toolCalls,
        model: res.model || 'gemini-2.5-flash',
        latencyMs: res.latencyMs,
        source: res.source,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-err',
        role: 'assistant',
        content: `Request not completed: ${err instanceof Error ? err.message : 'Unexpected service failure.'} No recommendations were substituted. Retry the request; if the issue persists, check the service configuration and logs.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      {/* Agent Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 p-0.5 shadow-md">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white">Atlanta Climate Advisor</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                gemini-2.5-flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Live Cloud Run ADK Agent • BigQuery ML Siting & Equity Tools
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="font-mono text-[11px] text-slate-400 hidden sm:inline">
            Endpoint: <code className="text-rose-400">/run</code>
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
            {useMockMode ? 'MOCK ENGINE' : 'CLOUD RUN LIVE'}
          </span>
        </div>
      </div>

      {/* Preset Planner Question Chips Bar */}
      <div className="p-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1 flex items-center space-x-1 flex-shrink-0">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Planner Questions:</span>
        </span>
        {plannerQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q.query)}
            disabled={isLoading}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition-all hover:border-slate-600 disabled:opacity-50"
          >
            <span>{q.icon}</span>
            <span>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const evidence = !isUser && !msg.isError ? rankingEvidence(msg.toolCalls ?? []) : [];

          return (
            <div key={msg.id} className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isUser ? 'bg-slate-700 text-white' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-2xl ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-rose-600 text-white rounded-tr-none shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
                  }`}
                >
                  {evidence.map((ranking, index) => (
                    <RecommendationCards
                      key={index} evidence={ranking} isMock={msg.source === 'mock'}
                      disabled={isLoading || (msg.source === 'mock') !== useMockMode}
                      onAudit={handleSendMessage}
                    />
                  ))}
                  {evidence.length > 0 ? (
                    <details className="text-slate-300">
                      <summary className="cursor-pointer text-xs">Advisor interpretation (model-generated)</summary>
                      <div className="mt-2 whitespace-pre-wrap">{msg.content}</div>
                    </details>
                  ) : (
                    <div role={msg.isError ? 'alert' : undefined} className="whitespace-pre-wrap">{msg.content}</div>
                  )}

                  {/* Tool Calls Inspector Accordion */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-mono mb-2">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Invoked Agent Tool:</span>
                      </div>
                      {msg.toolCalls.map((tc, tcIdx) => {
                        const isOpen = openToolTraceId === `${msg.id}-${tcIdx}`;

                        return (
                          <div
                            key={tcIdx}
                            className="rounded-lg bg-slate-950 border border-slate-800/90 text-xs overflow-hidden mb-1.5"
                          >
                            <button
                              onClick={() => setOpenToolTraceId(isOpen ? null : `${msg.id}-${tcIdx}`)}
                              className="w-full px-3 py-1.5 flex items-center justify-between text-left text-slate-300 hover:text-white bg-slate-950/80 font-mono text-[11px]"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-slate-300">⚡ {tc.name}</span>
                              </div>
                              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>

                            {isOpen && (
                              <div className="p-3 bg-slate-950 border-t border-slate-900 font-mono text-[11px] text-slate-400 overflow-x-auto space-y-2">
                                <div>
                                  <div className="text-slate-500 font-bold">Input Arguments:</div>
                                  <pre className="text-amber-300">{JSON.stringify(tc.arguments, null, 2)}</pre>
                                </div>
                                {tc.output && (
                                  <div>
                                    <div className="text-slate-500 font-bold">Tool Execution Result:</div>
                                    <pre className="text-emerald-300">{JSON.stringify(tc.output, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Metadata timestamp & latency */}
                <div className="flex items-center space-x-2 mt-1 px-1 text-[10px] text-slate-500">
                  <span>{msg.timestamp}</span>
                  {msg.source && <span>{msg.source === 'mock' ? 'Simulated · not live evidence' : 'Live agent response'}</span>}
                  {msg.latencyMs && (
                    <>
                      <span>•</span>
                      <span className="flex items-center space-x-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{msg.latencyMs}ms</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-none bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center space-x-2">
              <div className="flex space-x-1">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
              </div>
              <span>Querying Cloud Run Agent (BigQuery ML & Vertex AI)...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            aria-label="Message to Atlanta Climate Advisor"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask the Resilience Advisor about siting, heat disparities, or demographics..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-rose-500 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={isLoading || !inputPrompt.trim()}
            className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white transition-all shadow-md flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
