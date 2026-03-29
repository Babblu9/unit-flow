'use client';

import ChatPanel from '@/components/ChatPanel';
import SheetViewer from '@/components/SheetViewer';
import ConversationSidebar from '@/components/ConversationSidebar';
import { useUnitEconomics } from '@/context/UnitEconomicsContext';
import { mapDraftToTemplate } from '@/lib/excel/cellMapper';
import {
  PanelLeftClose, PanelLeft, MessageCircle, Table2,
  Send, ArrowRight, Utensils, ShoppingBag,
  Laptop, Loader2, Clock, MessageSquare, CheckCircle2, Trash2,
} from 'lucide-react';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import { useState, useRef, useCallback, useEffect } from 'react';

/* ── Pill suggestions for the welcome hero ── */
const HERO_SUGGESTIONS = [
  { icon: Utensils, label: 'Cloud kitchen in Mumbai, early stage, 8 people' },
  { icon: Laptop, label: 'SaaS startup in Bangalore, 5 engineers' },
  { icon: ShoppingBag, label: 'D2C skincare brand, growth stage' },
];

export default function HomePage() {
  const { isSignedIn } = useAuth();
  const {
    messages, setMessages,
    conversationId, setConversationId,
    currentStep, setCurrentStep,
    completion, setCompletion,
    isGenerating, setIsGenerating,
    isLoadingConversation,
    loadConversation,
    navigateToSheet,
    setBusinessInfo,
    setEmployees, setMarketingChannels, setProducts,
    setCities, setAdminExpenses, setCapexItems, setLoans,
    setLtvParams, setScenarios, setProfitTargets,
    applyTemplateOverrides,
  } = useUnitEconomics();

  const [mobileTab, setMobileTab] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [heroInput, setHeroInput] = useState('');
  const heroInputRef = useRef(null);
  const [recentConvos, setRecentConvos] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch recent conversations for the hero page
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingHistory(true);
        const res = await fetch('/api/conversations');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setRecentConvos((data.conversations || []).slice(0, 4));
      } catch (err) {
        // Not signed in or other error — silently ignore
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  // Detect welcome phase: no messages from the user yet
  const isWelcome = currentStep === 'welcome' && messages.filter(m => m.role === 'user').length === 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diffMs = Date.now() - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  /* ── Send first message from hero screen ── */
  const sendFirstMessage = useCallback(async (text) => {
    if (!text?.trim() || isGenerating) return;

    const userMsg = { role: 'user', text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setHeroInput('');
    setCurrentStep('extract'); // Transition out of welcome
    setIsGenerating(true);

    try {
      const res = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), conversationId, step: 'extract' }),
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
  }, [isGenerating, conversationId, setMessages, setConversationId, setCurrentStep, setCompletion, setIsGenerating, navigateToSheet, setBusinessInfo, setEmployees, setMarketingChannels, setProducts, setCities, setAdminExpenses, setCapexItems, setLoans, setLtvParams, setScenarios, setProfitTargets, applyTemplateOverrides]);

  /* ═══════════════════════════════════════════
     WELCOME HERO SCREEN
     ═══════════════════════════════════════════ */
  if (isWelcome) {
    return (
      <div className="flex flex-col h-screen" style={{ background: 'linear-gradient(160deg, #0F1A2E 0%, #1B2A4A 35%, #2D4373 100%)' }}>

        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Top bar - minimal */}
        <header className="relative flex items-center justify-between px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
              <Image src="/logos/unit-flow.png" alt="Unit Flow" width={28} height={28} className="object-contain" />
            </div>
            <span className="text-sm font-bold text-white tracking-[-0.02em]">Unit Flow</span>
            <span className="text-[11px] text-white/40 font-medium">by</span>
            <Image src="/logos/logo1.png" alt="OnEasy" width={64} height={20} className="object-contain" />
          </div>
          <div className="flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <button className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white/70 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white transition-colors" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
                    Sign Up
                  </button>
                </SignUpButton>
              </>
            ) : (
              <UserButton afterSignOutUrl="/" />
            )}
          </div>
        </header>

        {/* Center hero content */}
        <div className="relative flex-1 flex flex-col items-center px-6 py-6 overflow-y-auto min-h-0">
          {/* Spacer to push content toward center when content is short */}
          <div className="flex-1 min-h-[20px] max-h-[15vh]" />

          {/* Glowing orb behind title */}
          <div className="absolute w-[400px] h-[400px] rounded-full opacity-20" style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }} />

          {/* Title */}
          <h2
            className="relative text-center text-[1.8rem] md:text-[2.2rem] font-bold text-white leading-[1.15] tracking-[-0.03em] mb-5 slide-up"
            style={{ animationDelay: '0.1s' }}
          >
            Build your Unit Economics<br />
            <span style={{ background: 'linear-gradient(135deg, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              in minutes, not weeks.
            </span>
          </h2>

          {/* Big input area */}
          <div
            className="relative w-full max-w-2xl slide-up"
            style={{ animationDelay: '0.3s' }}
            suppressHydrationWarning
          >
            <div
              className="flex items-start gap-3 p-3 rounded-2xl transition-all"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              suppressHydrationWarning
            >
              <textarea
                ref={heroInputRef}
                value={heroInput}
                onChange={(e) => setHeroInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendFirstMessage(heroInput);
                  }
                }}
                placeholder="Describe your business... e.g. &quot;I run a cloud kitchen in Mumbai with 8 staff, selling biryanis and thalis&quot;"
                rows={1}
                disabled={isGenerating}
                className="flex-1 resize-none bg-transparent border-none outline-none text-[14px] leading-[1.6] text-white placeholder:text-white/30"
                style={{ minHeight: '40px', maxHeight: '80px' }}
                data-enable-grammarly="false"
                data-gramm="false"
                data-gramm_editor="false"
                autoFocus
              />
              <button
                onClick={() => sendFirstMessage(heroInput)}
                disabled={!heroInput.trim() || isGenerating}
                className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 mt-0.5 transition-all disabled:opacity-30"
                style={{
                  background: heroInput.trim() && !isGenerating
                    ? 'linear-gradient(135deg, #3B82F6, #6366F1)'
                    : 'rgba(255,255,255,0.08)',
                }}
              >
                {isGenerating
                  ? <Loader2 className="w-4 h-4 text-white spin" />
                  : <ArrowRight className="w-4 h-4 text-white" />}
              </button>
            </div>

            {/* Hint text */}
            <p className="mt-2.5 text-center text-[11px] text-white/30">
              Press Enter to send · The more detail you give, the better the model
            </p>
          </div>

          {/* Suggestion pills */}
          <div
            className="relative mt-4 flex flex-wrap justify-center gap-2 max-w-2xl slide-up"
            style={{ animationDelay: '0.45s' }}
          >
            {HERO_SUGGESTIONS.map((s, i) => {
              const Icon = s.icon;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setHeroInput(s.label);
                    heroInputRef.current?.focus();
                  }}
                  className="group flex items-center gap-2 px-3.5 py-2 rounded-full text-[12px] text-white/50 transition-all hover:text-white/80"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate max-w-[220px]">{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Recent Models (only when has history) */}
          {recentConvos.length > 0 && (
            <div
              className="relative mt-6 w-full max-w-2xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-white/30" />
                <span className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.06em]">Recent Models</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recentConvos.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => loadConversation(convo.id)}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    }}
                  >
                    <MessageSquare className="w-4 h-4 text-white/30 flex-shrink-0 group-hover:text-white/60 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white/70 truncate group-hover:text-white/90 transition-colors">
                        {convo.title || 'Untitled Model'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {convo.completion >= 100 ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400/70">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Done
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/30">{convo.completion || 0}%</span>
                        )}
                        <span className="text-[10px] text-white/20">{formatDate(convo.updatedAt)}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Bottom spacer to balance layout */}
          <div className="flex-1 min-h-[20px]" />
        </div>

        {/* Bottom attribution */}
        <footer className="relative flex items-center justify-center py-4">
          <p className="text-[10px] text-white/20">
            Founded by CA Abhishek Boddu · OnEasy Consultants Pvt Ltd
          </p>
        </footer>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     MAIN APP LAYOUT (post-welcome)
     ═══════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-page)]">

      {/* ── Top bar ── */}
      <header
        className="flex items-center justify-between px-5 h-[52px] flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #1B2A4A 0%, #2D4373 100%)',
          boxShadow: '0 2px 12px rgba(27,42,74,0.25)',
        }}
      >
        {/* Left: sidebar toggle + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(s => !s)}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <Image src="/logos/unit-flow.png" alt="Unit Flow" width={24} height={24} className="object-contain" />
            </div>
            <span className="text-[13px] font-bold text-white tracking-[-0.02em]">Unit Flow</span>
            <span className="text-[10px] text-white/50 font-medium">by</span>
            <Image src="/logos/logo1.png" alt="OnEasy" width={56} height={18} className="object-contain" />
          </div>
        </div>

        {/* Center: mobile tab toggle */}
        <div className="flex md:hidden bg-white/10 rounded-lg p-0.5 backdrop-blur-sm">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
              mobileTab === 'chat'
                ? 'bg-white text-[var(--navy)] shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <MessageCircle className="w-3 h-3" />
            Chat
          </button>
          <button
            onClick={() => setMobileTab('sheets')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
              mobileTab === 'sheets'
                ? 'bg-white text-[var(--navy)] shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Table2 className="w-3 h-3" />
            Sheets
          </button>
        </div>

        {/* Right: progress + 17 sheets badge */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-28 h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-[800ms]"
                style={{
                  width: `${completion}%`,
                  background: completion >= 100
                    ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                    : 'linear-gradient(90deg, #FBBF24, #F59E0B)',
                }}
              />
            </div>
            <span className="text-[11px] text-white/60 font-medium font-num">{completion}%</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <Table2 className="w-3 h-3" />
            17 sheets
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Loading overlay for conversation switch */}
        {isLoadingConversation && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-[2.5px] border-[var(--border)] border-t-[var(--navy)] rounded-full spin" />
              <span className="text-[13px] text-[var(--text-secondary)] font-medium">Loading conversation...</span>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <ConversationSidebar
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(s => !s)}
        />

        {/* Chat panel */}
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex w-full md:w-[420px] lg:w-[460px] flex-shrink-0 border-r border-[var(--border)]`}>
          <ChatPanel />
        </div>

        {/* Sheet viewer (card-based UI) */}
        <div className={`${mobileTab === 'sheets' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0`}>
          <SheetViewer />
        </div>
      </div>
    </div>
  );
}
