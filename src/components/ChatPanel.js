'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUnitEconomics } from '@/context/UnitEconomicsContext';
import { Send, Download, ChevronRight, Loader2, Plus, FileSpreadsheet, MessageCircle } from 'lucide-react';

/**
 * ChatPanel — Left side of the split layout.
 * Handles the conversational flow with the AI agent.
 */
export default function ChatPanel() {
  const {
    messages, setMessages,
    conversationId, setConversationId,
    currentStep, setCurrentStep,
    completion, setCompletion,
    isGenerating, setIsGenerating,
    navigateToSheet,
    businessInfo, setBusinessInfo,
  } = useUnitEconomics();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: '',
        displayText: `Welcome to **Unit Economics Engine** by OnEasy! \ud83d\udcca\n\nI'll help you build a complete 17-sheet Unit Economics model for your business. Just describe your business and I'll handle the rest.\n\n**What does your business do?** Tell me your company name, what you sell, and who your customers are.`,
        suggestions: ['Let me describe my business', 'I have an existing business', 'I\'m exploring a new idea'],
        timestamp: Date.now(),
      }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isGenerating) return;

    const userMsg = { role: 'user', text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    try {
      const res = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversationId,
          step: currentStep,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Update conversation state
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.step) setCurrentStep(data.step);
      if (data.completion) setCompletion(data.completion);

      // Navigate to sheet if AI says so
      if (data.sheetNav) navigateToSheet(data.sheetNav);

      // Add AI response
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
  }, [isGenerating, conversationId, currentStep, setMessages, setConversationId, setCurrentStep, setCompletion, setIsGenerating, navigateToSheet]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
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
        body: JSON.stringify({ conversationId }),
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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-navy to-navy-dark">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-white" />
          <h2 className="text-white font-semibold text-sm">Unit Economics AI</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="text-white/70 text-xs">{completion}%</span>
          </div>
          {/* Download button */}
          {currentStep === 'confirm_review' || currentStep === 'complete' ? (
            <button
              onClick={handleDownloadExcel}
              disabled={isGenerating}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </button>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 excel-scroll">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user'
              ? 'bg-navy text-white rounded-2xl rounded-br-sm px-4 py-2.5'
              : 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm px-4 py-2.5'
              }`}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {formatMessage(msg.displayText || msg.text)}
              </div>

              {/* Draft summary card */}
              {msg.draft && (
                <div className="mt-3 p-3 bg-white/80 rounded-lg border border-green-200">
                  <div className="text-xs font-semibold text-green-700 mb-1">Model Generated</div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                    <span>{msg.draft.employeeCount} employees</span>
                    <span>{msg.draft.productCount} products</span>
                    <span>{msg.draft.channelCount} marketing channels</span>
                    <span>{msg.draft.cityCount} cities</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
              <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
              <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
              <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
            </div>
          </div>
        )}

        {/* Suggestions */}
        {messages.length > 0 && !isGenerating && (
          (() => {
            const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
            if (!lastAssistant?.suggestions?.length) return null;
            return (
              <div className="flex flex-wrap gap-2 pl-1">
                {lastAssistant.suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-full hover:bg-navy hover:text-white hover:border-navy transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            );
          })()
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-all"
            disabled={isGenerating}
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="p-2.5 bg-navy text-white rounded-xl hover:bg-navy-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Basic markdown-lite formatter for chat messages.
 */
function formatMessage(text) {
  if (!text) return '';
  // Bold: **text**
  return text.replace(/\*\*(.*?)\*\*/g, '\u200B$1\u200B');  // Placeholder, actual rendering handled by whitespace-pre-wrap
}
