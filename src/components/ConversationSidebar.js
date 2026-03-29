'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUnitEconomics } from '@/context/UnitEconomicsContext';
import {
  Plus, MessageSquare, Clock, CheckCircle2,
  ChevronLeft, ChevronRight, Trash2, Loader2, BarChart3,
} from 'lucide-react';

export default function ConversationSidebar({ collapsed, onToggle }) {
  const { conversationId, loadConversation, resetConversation } = useUnitEconomics();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations, conversationId]);

  const handleNewModel = () => resetConversation();

  const handleSelect = async (id) => {
    if (id === conversationId) return;
    await loadConversation(id);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (deleting) return;
    try {
      setDeleting(id);
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (id === conversationId) resetConversation();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setDeleting(null);
    }
  };

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

  // ── Collapsed rail ──
  if (collapsed) {
    return (
      <div className="hidden md:flex flex-col items-center w-[44px] bg-[var(--bg-page)] border-r border-[var(--border)] py-3 gap-2 flex-shrink-0">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--navy)] hover:bg-[var(--bg-hover)] transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleNewModel}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--navy)] hover:bg-[var(--navy)]/10 transition-colors"
          title="New Model"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ── Expanded sidebar ──
  return (
    <div className="hidden md:flex flex-col w-[240px] bg-[var(--bg-page)] border-r border-[var(--border)] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border)]">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.08em]">History</span>
        <button
          onClick={onToggle}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New Model button */}
      <div className="px-3 py-2.5">
        <button
          onClick={handleNewModel}
          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-semibold text-white rounded-lg transition-all hover-lift"
          style={{
            background: 'linear-gradient(135deg, #1B2A4A 0%, #2D4373 100%)',
            boxShadow: '0 2px 8px rgba(27,42,74,0.25)',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Model
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 excel-scroll">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 text-[var(--text-muted)] spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-10 px-3">
            <BarChart3 className="w-8 h-8 text-[var(--border)] mx-auto mb-2" />
            <p className="text-[11px] text-[var(--text-muted)]">No models yet</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Start a new model to begin</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((convo) => {
              const isActive = convo.id === conversationId;
              return (
                <div
                  key={convo.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(convo.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(convo.id); } }}
                  className="group w-full text-left px-2.5 py-2.5 rounded-lg transition-all cursor-pointer"
                  style={{
                    background: isActive ? 'rgba(27,42,74,0.08)' : 'transparent',
                    border: isActive ? '1px solid rgba(27,42,74,0.12)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-[var(--navy)]' : 'text-[var(--text-muted)]'}`} />
                        <span className={`text-[12px] font-medium truncate block ${isActive ? 'text-[var(--navy)]' : 'text-[var(--text-secondary)]'}`}>
                          {convo.title || 'New Model'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-[18px]">
                        {convo.completion >= 100 ? (
                          <CheckCircle2 className="w-3 h-3 text-[var(--green-light)]" />
                        ) : (
                          <div className="w-8 h-1 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${convo.completion || 0}%`,
                                background: 'var(--gold)',
                              }}
                            />
                          </div>
                        )}
                        <span className="text-[10px] text-[var(--text-muted)] font-num">
                          {convo.completion >= 100 ? 'Done' : `${convo.completion || 0}%`}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-[var(--border)]" />
                          <span className="text-[10px] text-[var(--text-muted)]">{formatDate(convo.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, convo.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-[var(--text-muted)] transition-all"
                    >
                      {deleting === convo.id ? <Loader2 className="w-3 h-3 spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
