'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUnitEconomics } from '@/context/UnitEconomicsContext';
import { mapDraftToTemplate } from '@/lib/excel/cellMapper';
import { Send, Download, Loader2, Paperclip, X, Sparkles, ArrowRight, Check, Circle, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/* ── Step progression config ── */
const STEPS = [
  { key: 'extract',        label: 'Describe' },
  { key: 'fill_gaps',      label: 'Details' },
  { key: 'generate',       label: 'Generate' },
  { key: 'confirm_review', label: 'Review' },
  { key: 'complete',       label: 'Done' },
];

function StepProgressBar({ currentStep }) {
  const currentIdx = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center gap-1 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
      {STEPS.map((step, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            {/* Step dot + label */}
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={
                  isComplete
                    ? { background: 'var(--green)', color: '#fff' }
                    : isCurrent
                      ? { background: 'var(--navy)', color: '#fff', boxShadow: '0 0 0 3px rgba(27,42,74,0.15)' }
                      : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }
                }
              >
                {isComplete ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span className="text-[9px] font-bold">{i + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold truncate transition-colors duration-300 ${
                  isComplete ? 'text-[var(--green)]'
                    : isCurrent ? 'text-[var(--navy)]'
                      : 'text-[var(--text-muted)]'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-1.5 h-[2px] rounded-full transition-colors duration-500" style={{
                background: isComplete ? 'var(--green)' : 'var(--bg-muted)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Inline helper: format INR ── */
function fmtINR(n) {
  if (n == null || isNaN(n)) return '\u20B90';
  return '\u20B9' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/* ── Cost Suggestion Cards (rendered inside chat messages) ── */
function CostSuggestionCards({ suggestions, onAccept, onDismiss, liveSuggestions }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!suggestions?.length) return null;

  // Use live status from context (persists accept/dismiss across renders)
  const getStatus = (s) => {
    const live = liveSuggestions?.find(ls => ls.id === s.id);
    return live?.status || s.status || 'pending';
  };

  const impactColors = { high: '#DC2626', medium: '#D97706', low: '#15803D' };
  const impactBg = { high: '#FEF2F2', medium: '#FFFBEB', low: '#F0FDF4' };

  const totalSavings = suggestions
    .filter(s => getStatus(s) !== 'dismissed')
    .reduce((sum, s) => sum + (s.monthlySavings || 0), 0);

  return (
    <div className="mt-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5" style={{ color: '#15803D' }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.04em]" style={{ color: '#15803D' }}>
            Smart Suggestions
          </span>
        </div>
        <span className="text-[10px] font-num px-2 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#15803D' }}>
          Save up to {fmtINR(totalSavings)}/mo
        </span>
      </div>

      {/* Cards */}
      {suggestions.map((s) => {
        const status = getStatus(s);
        const isExpanded = expandedId === s.id;
        const isResolved = status === 'accepted' || status === 'dismissed';

        return (
          <div
            key={s.id}
            className="rounded-lg border transition-all"
            style={{
              borderColor: isResolved ? '#E2E8F0' : '#E2E8F0',
              background: status === 'accepted' ? '#F0FDF4' : status === 'dismissed' ? '#F8FAFC' : '#FFFFFF',
              opacity: status === 'dismissed' ? 0.55 : 1,
            }}
          >
            {/* Card header — always visible */}
            <div
              className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : s.id)}
            >
              {/* Impact dot */}
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full" style={{ background: impactColors[s.impact] || '#94A3B8' }} />
              </div>

              {/* Title + savings */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold truncate" style={{ color: status === 'dismissed' ? '#94A3B8' : '#0F172A' }}>
                    {s.title}
                  </span>
                  {status === 'accepted' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#15803D' }}>
                      APPLIED
                    </span>
                  )}
                  {status === 'dismissed' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#94A3B8' }}>
                      SKIPPED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] font-num" style={{ color: '#64748B' }}>
                    {fmtINR(s.currentCost)} → {fmtINR(s.suggestedCost)}
                  </span>
                  <span className="text-[10px] font-bold font-num" style={{ color: '#15803D' }}>
                    Save {fmtINR(s.monthlySavings)}/mo
                  </span>
                </div>
              </div>

              {/* Expand chevron */}
              <div className="flex-shrink-0 mt-1">
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
                  : <ChevronRight className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} />}
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-0 border-t" style={{ borderColor: '#F1F5F9' }}>
                <p className="text-[11px] mt-2 leading-[1.5]" style={{ color: '#334155' }}>
                  {s.description}
                </p>

                {/* Impact badge */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{
                    background: impactBg[s.impact] || '#F8FAFC',
                    color: impactColors[s.impact] || '#64748B',
                  }}>
                    {s.impact} impact
                  </span>
                  <span className="text-[10px]" style={{ color: '#94A3B8' }}>{s.category}</span>
                </div>

                {/* Tradeoffs */}
                {s.tradeoffs && (
                  <p className="text-[10px] mt-1.5 italic" style={{ color: '#94A3B8' }}>
                    Tradeoff: {s.tradeoffs}
                  </p>
                )}

                {/* Action buttons — only for pending suggestions */}
                {!isResolved && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAccept(s.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all hover:shadow-sm"
                      style={{ background: '#15803D', color: '#fff' }}
                    >
                      <Check className="w-3 h-3" /> Apply this
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDismiss(s.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all"
                      style={{ background: '#F1F5F9', color: '#64748B' }}
                    >
                      <X className="w-3 h-3" /> Skip
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatPanel() {
  const {
    messages, setMessages,
    conversationId, setConversationId,
    currentStep, setCurrentStep,
    completion, setCompletion,
    isGenerating, setIsGenerating,
    navigateToSheet,
    businessInfo, setBusinessInfo,
    setEmployees, setMarketingChannels, setProducts,
    setCities, setAdminExpenses, setCapexItems, setLoans,
    setLtvParams, setScenarios, setProfitTargets,
    setCostSuggestions, costSuggestions,
    acceptSuggestion, dismissSuggestion,
    applyTemplateOverrides, templateOverrides,
  } = useUnitEconomics();

  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setAttachment(data.file);
    } catch (err) {
      console.error('Upload error:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const removeAttachment = useCallback(() => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isGenerating) return;

    let fullMessage = text.trim();
    if (attachment?.extractedText) {
      fullMessage += `\n\n[ATTACHMENT: ${attachment.name}]\n${attachment.extractedText}`;
    }

    const userMsg = {
      role: 'user',
      text: text.trim(),
      attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachment(null);
    setIsGenerating(true);

    try {
      const res = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullMessage, conversationId, step: currentStep }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get response');

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.step) setCurrentStep(data.step);
      if (data.completion) setCompletion(data.completion);
      if (data.sheetNav) navigateToSheet(data.sheetNav);

      // Hydrate context from draft
      if (data.draftData) {
        const dd = data.draftData;
        if (dd.businessInfo)      setBusinessInfo(dd.businessInfo);
        if (dd.employees)         setEmployees(dd.employees);
        if (dd.marketingChannels) setMarketingChannels(dd.marketingChannels);
        if (dd.products)          setProducts(dd.products);
        if (dd.cities)            setCities(dd.cities);
        if (dd.adminExpenses)     setAdminExpenses(dd.adminExpenses);
        if (dd.capexItems)        setCapexItems(dd.capexItems);
        if (dd.loans)             setLoans(dd.loans);
        if (dd.ltvParams)         setLtvParams(dd.ltvParams);
        if (dd.scenarios)         setScenarios(dd.scenarios);
        if (dd.profitTargets)     setProfitTargets(dd.profitTargets);
        if (dd.costSuggestions)   setCostSuggestions(dd.costSuggestions);

        // Map draft to template cell addresses and apply as overrides
        if (data.rawDraft) {
          try {
            const patches = mapDraftToTemplate(data.rawDraft, {
              companyName: data.rawDraft.companyName || dd.businessInfo?.companyName,
              city: dd.businessInfo?.city,
            });
            applyTemplateOverrides(patches);
          } catch (e) {
            console.error('cellMapper error:', e);
          }
        }

        navigateToSheet('1. HR Costs');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.message,
        displayText: data.message,
        suggestions: data.suggestions || [],
        sheetNav: data.sheetNav,
        draft: data.draft,
        costSuggestions: data.costSuggestions || null,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        displayText: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        suggestions: ['Try again'],
        timestamp: Date.now(),
      }]);
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, conversationId, currentStep, attachment, setMessages, setConversationId, setCurrentStep, setCompletion, setIsGenerating, navigateToSheet, setBusinessInfo, setEmployees, setMarketingChannels, setProducts, setCities, setAdminExpenses, setCapexItems, setLoans, setLtvParams, setScenarios, setProfitTargets, setCostSuggestions, applyTemplateOverrides]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleDownloadExcel = async () => {
    if (!conversationId) return;
    try {
      setIsGenerating(true);
      const res = await fetch('/api/excel-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, templateOverrides: templateOverrides || {} }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'UnitEconomics.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert(`Download failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const showDownload = currentStep === 'confirm_review' || currentStep === 'complete';

  // Determine placeholder text based on step
  const placeholderText =
    currentStep === 'extract' || currentStep === 'welcome'
      ? 'Describe your business...'
      : currentStep === 'fill_gaps'
        ? 'Answer the questions above, or type "go ahead" to use defaults...'
        : currentStep === 'confirm_review'
          ? 'Ask to modify anything, or say "looks good"...'
          : 'Type a message...';

  return (
    <div className="flex flex-col h-full w-full bg-white">

      {/* ── Step Progression Bar ── */}
      {currentStep !== 'welcome' && (
        <StepProgressBar currentStep={currentStep} />
      )}

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 excel-scroll">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} fade-in`}
            style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}
          >
            {/* AI avatar */}
            {msg.role === 'assistant' && (
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 mr-2.5 mt-0.5 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #1B2A4A 0%, #2D4373 100%)' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] ${
                msg.role === 'user'
                  ? 'px-4 py-2.5'
                  : 'px-4 py-3'
              }`}
              style={msg.role === 'user' ? {
                background: 'linear-gradient(135deg, #1B2A4A 0%, #2D4373 100%)',
                color: '#fff',
                borderRadius: '16px 16px 4px 16px',
                boxShadow: '0 2px 8px rgba(27,42,74,0.25)',
              } : {
                background: '#FFFFFF',
                border: '1px solid var(--border)',
                borderRadius: '4px 16px 16px 16px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="text-[13px] leading-[1.65] chat-md">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    strong: ({ children }) => (
                      <strong className="font-semibold" style={{ color: msg.role === 'user' ? '#fff' : 'var(--navy)' }}>
                        {children}
                      </strong>
                    ),
                    ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    code: ({ children }) => (
                      <code className="px-1.5 py-0.5 rounded text-[11px] font-num" style={{ background: msg.role === 'user' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' }}>
                        {children}
                      </code>
                    ),
                  }}
                >
                  {msg.displayText || msg.text || ''}
                </ReactMarkdown>
              </div>

              {/* Draft summary */}
              {msg.draft && (
                <div
                  className="mt-3 p-3 rounded-lg border"
                  style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 40%)', borderColor: '#BBF7D0' }}
                >
                  <div className="text-[11px] font-bold text-[var(--green)] uppercase tracking-[0.05em] mb-1.5">Model Generated</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[var(--text-secondary)]">
                    <span className="font-num">{msg.draft.employeeCount} employees</span>
                    <span className="font-num">{msg.draft.productCount} products</span>
                    <span className="font-num">{msg.draft.channelCount} channels</span>
                    <span className="font-num">{msg.draft.cityCount} cities</span>
                  </div>
                </div>
              )}

              {/* Cost suggestion cards — interactive accept/dismiss */}
              {msg.costSuggestions?.length > 0 && (
                <CostSuggestionCards
                  suggestions={msg.costSuggestions}
                  liveSuggestions={costSuggestions}
                  onAccept={acceptSuggestion}
                  onDismiss={dismissSuggestion}
                />
              )}

              {/* Attachment badge */}
              {msg.attachment && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] opacity-70">
                  <Paperclip className="w-3 h-3" />
                  <span>{msg.attachment.name}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isGenerating && (
          <div className="flex justify-start fade-in">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 mr-2.5 mt-0.5 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1B2A4A 0%, #2D4373 100%)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div
              className="px-4 py-3 flex items-center gap-1.5"
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                borderRadius: '4px 16px 16px 16px',
              }}
            >
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] typing-dot" />
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] typing-dot" />
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] typing-dot" />
            </div>
          </div>
        )}

        {/* Suggestion pills */}
        {messages.length > 0 && !isGenerating && (() => {
          const lastAI = [...messages].reverse().find(m => m.role === 'assistant');
          if (!lastAI?.suggestions?.length) return null;
          return (
            <div className="flex flex-wrap gap-2 pl-[42px]">
              {lastAI.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="group flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-full border transition-all hover-lift"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--navy)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = 'var(--navy)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--bg-surface)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  {s}
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          );
        })()}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom input bar ── */}
      <div className="border-t border-[var(--border)] bg-white px-4 py-3">
        {/* Download banner when model is ready */}
        {showDownload && (
          <button
            onClick={handleDownloadExcel}
            disabled={isGenerating}
            className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover-lift disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
              boxShadow: '0 4px 12px rgba(21,128,61,0.3)',
            }}
          >
            <Download className="w-4 h-4" />
            Download Excel Model (17 Sheets)
          </button>
        )}

        {/* Attachment preview */}
        {attachment && (
          <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-lg" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <Paperclip className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="text-[12px] text-blue-700 truncate flex-1 font-medium">{attachment.name}</span>
            <span className="text-[11px] text-blue-400 font-num flex-shrink-0">{(attachment.size / 1024).toFixed(0)}KB</span>
            <button onClick={removeAttachment} className="p-0.5 rounded hover:bg-blue-100 transition-colors">
              <X className="w-3.5 h-3.5 text-blue-500" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Attach button */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.csv,.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating || uploading}
              className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--text-muted)] hover:text-[var(--navy)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-30"
            >
              {uploading ? <Loader2 className="w-4 h-4 spin" /> : <Paperclip className="w-4 h-4" />}
            </button>

            {/* Textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              rows={1}
              className="flex-1 resize-none py-2 text-[13px] leading-[1.5] bg-transparent border-none outline-none placeholder:text-[var(--text-muted)]"
              style={{ minHeight: '26px', maxHeight: '140px' }}
              disabled={isGenerating}
            />

            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all disabled:opacity-20"
              style={{
                background: input.trim() && !isGenerating ? 'var(--navy)' : 'var(--bg-muted)',
                color: input.trim() && !isGenerating ? '#fff' : 'var(--text-muted)',
              }}
            >
              {isGenerating ? <Loader2 className="w-4 h-4 spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="mt-1.5 pl-3 text-[10px] text-[var(--text-muted)]">
            Press Enter to send, Shift+Enter for new line
          </div>
        </form>
      </div>
    </div>
  );
}
