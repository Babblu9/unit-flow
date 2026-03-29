'use client';

import ChatPanel from '@/components/ChatPanel';
import SheetViewer from '@/components/SheetViewer';
import { useUnitEconomics } from '@/context/UnitEconomicsContext';
import { FileSpreadsheet, BarChart3 } from 'lucide-react';
import { useState } from 'react';

/**
 * Main page — Split layout:
 * Left: ChatPanel (AI conversation)
 * Right: SheetViewer (17-sheet Excel preview)
 *
 * On mobile: tab toggle between chat and sheets.
 */
export default function HomePage() {
  const { completion } = useUnitEconomics();
  const [mobileTab, setMobileTab] = useState('chat');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-navy leading-tight">Unit Economics Engine</h1>
            <p className="text-[10px] text-slate-400 leading-tight">by OnEasy Consultants</p>
          </div>
        </div>

        {/* Mobile tab toggle */}
        <div className="flex md:hidden bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setMobileTab('chat')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mobileTab === 'chat' ? 'bg-white text-navy shadow-sm' : 'text-slate-500'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileTab('sheets')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mobileTab === 'sheets' ? 'bg-white text-navy shadow-sm' : 'text-slate-500'
            }`}
          >
            Sheets
          </button>
        </div>

        {/* Desktop indicators */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>17 sheets</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${completion >= 100 ? 'bg-green-500' : 'bg-amber-400'}`} />
            <span>{completion >= 100 ? 'Model ready' : 'Building...'}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: side-by-side */}
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex w-full md:w-[420px] lg:w-[480px] flex-shrink-0 border-r border-slate-200`}>
          <div className="w-full">
            <ChatPanel />
          </div>
        </div>
        <div className={`${mobileTab === 'sheets' ? 'flex' : 'hidden'} md:flex flex-1`}>
          <div className="w-full">
            <SheetViewer />
          </div>
        </div>
      </div>
    </div>
  );
}
