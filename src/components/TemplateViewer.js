'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useUnitEconomics } from '@/context/UnitEconomicsContext';
import { FormulaEngine, formatCellValue } from '@/lib/excel/formulaEngine';

/* ════════════════════════════════════════════════════════
   Constants
   ════════════════════════════════════════════════════════ */
const T = {
  navy:      '#1B2A4A',
  navyLight: '#2D4373',
  teal:      '#0F766E',
  tealLight: '#14B8A6',
  green:     '#15803D',
  red:       '#E53935',
  t0: '#0F172A', t1: '#334155', t2: '#64748B', t3: '#94A3B8',
  header: '#1F4E79', input: '#C6EFCE', formula: '#BDD7EE', link: '#D6E4F0', total: '#D9E2F3',
};

// Sheet tab grouping — match the actual template sheet names
const INPUT_SHEETS = [
  'Instructions & Guide',
  '1. Unit Economics - HR Costs', '1.1 Rate Card',
  '2. Marketing Costs',
  '3. Manufacturing Costs',
  '3A. Geo Purchase Costs', '3B. Geo Sale Prices', '3C. Geo Selector',
  '3D. Admin & Other Expenses', '3E. Capital Expenses (CAPEX)', '3F. Finance Costs',
];
const OUTPUT_SHEETS = [
  '4. Product Market Mix', '5. Customer LTV Analysis',
  '6. Target Profit Calculator', '7. Cash Flow',
  '8. KPI Dashboard', '9. Scenario Analysis',
];

// Short display name for tabs
function shortName(name) {
  return name
    .replace('1. Unit Economics - ', '1. ')
    .replace(/^\d+[A-F]?\.\s*/, (m) => m)
    .replace('(CAPEX)', 'CAPEX');
}

/* ════════════════════════════════════════════════════════
   Color helpers
   ════════════════════════════════════════════════════════ */
function argbToHex(argb) {
  if (!argb) return null;
  // ARGB format: FF1F4E79 → #1F4E79
  if (argb.length === 8) return '#' + argb.slice(2);
  if (argb.startsWith('#')) return argb;
  return '#' + argb;
}

function isInputCell(cell) {
  return cell.t === 'input' || (cell.bg && cell.bg.toUpperCase() === 'FFC6EFCE');
}

function isFormulaCell(cell) {
  return cell.t === 'formula' || cell.t === 'crossref' || cell.t === 'subtotal';
}

function isHeaderCell(cell) {
  return cell.t === 'header' || cell.t === 'subheader';
}

/* ════════════════════════════════════════════════════════
   Cell background color
   ════════════════════════════════════════════════════════ */
function getCellBg(cell) {
  if (cell.bg) {
    const hex = argbToHex(cell.bg);
    if (hex) return hex;
  }
  // Fallback by type
  switch (cell.t) {
    case 'header':    return T.header;
    case 'subheader': return '#2E75B6';
    case 'input':     return T.input;
    case 'formula':   return T.formula;
    case 'crossref':  return T.link;
    case 'subtotal':  return T.total;
    default:          return '#FFFFFF';
  }
}

function getCellColor(cell) {
  if (cell.fc) return argbToHex(cell.fc);
  if (cell.t === 'header' || cell.t === 'subheader') return '#FFFFFF';
  return T.t0;
}

/* ════════════════════════════════════════════════════════
   Merge map builder
   ════════════════════════════════════════════════════════ */
function buildMergeMap(merges) {
  const map = {}; // { 'A1': { rowSpan, colSpan }, 'A2': 'hidden', ... }
  if (!merges) return map;

  for (const range of merges) {
    const [startRef, endRef] = range.split(':');
    const startMatch = startRef.match(/([A-Z]+)(\d+)/);
    const endMatch = endRef.match(/([A-Z]+)(\d+)/);
    if (!startMatch || !endMatch) continue;

    const startCol = colToIdx(startMatch[1]);
    const startRow = parseInt(startMatch[2], 10);
    const endCol = colToIdx(endMatch[1]);
    const endRow = parseInt(endMatch[2], 10);

    const rowSpan = endRow - startRow + 1;
    const colSpan = endCol - startCol + 1;

    map[startRef] = { rowSpan, colSpan };

    // Mark all other cells in the merge as hidden
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const addr = idxToCol(c) + r;
        if (addr !== startRef) {
          map[addr] = 'hidden';
        }
      }
    }
  }
  return map;
}

function colToIdx(col) {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx;
}

function idxToCol(idx) {
  let col = '';
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    idx = Math.floor((idx - 1) / 26);
  }
  return col;
}

/* ════════════════════════════════════════════════════════
   Column width to px (Excel units ≈ 7.5px per char width)
   ════════════════════════════════════════════════════════ */
function colWidthToPx(w) {
  if (!w || w <= 0) return 64;
  return Math.max(30, Math.min(400, Math.round(w * 7.5)));
}

/* ════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════ */
let descriptorCache = null;
let descriptorPromise = null;

function loadDescriptor() {
  if (descriptorCache) return Promise.resolve(descriptorCache);
  if (descriptorPromise) return descriptorPromise;
  descriptorPromise = fetch('/api/template-descriptor')
    .then(r => r.json())
    .then(d => { descriptorCache = d; return d; })
    .catch(err => {
      console.error('Failed to load template descriptor:', err);
      descriptorPromise = null;
      throw err;
    });
  return descriptorPromise;
}

export default function TemplateViewer() {
  const {
    activeSheet, setActiveSheet, flashingSheet,
    templateOverrides, templateOverrideVersion,
    setTemplateCell, completion,
  } = useUnitEconomics();

  const [descriptor, setDescriptor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load descriptor on mount
  useEffect(() => {
    loadDescriptor()
      .then(d => { setDescriptor(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Formula engine — recreated when overrides change
  const engine = useMemo(() => {
    if (!descriptor) return null;
    const eng = new FormulaEngine(descriptor, templateOverrides);
    eng.evaluateAll();
    return eng;
  }, [descriptor, templateOverrides, templateOverrideVersion]);

  // Find the active sheet object from descriptor
  const activeSheetObj = useMemo(() => {
    if (!descriptor) return null;
    // Match by name (exact or fuzzy)
    return descriptor.sheets.find(s => s.name === activeSheet)
      || descriptor.sheets.find(s => s.name.includes(activeSheet))
      || descriptor.sheets[0];
  }, [descriptor, activeSheet]);

  // Map from context short names to descriptor full names
  const sheetNameMap = useMemo(() => {
    if (!descriptor) return {};
    const map = {};
    for (const s of descriptor.sheets) {
      map[s.name] = s.name;
      // Also map short names
      const short = s.name.replace('1. Unit Economics - HR Costs', '1. HR Costs');
      if (short !== s.name) map[short] = s.name;
    }
    return map;
  }, [descriptor]);

  // All sheet names from descriptor
  const allSheetNames = useMemo(() => {
    if (!descriptor) return [];
    return descriptor.sheets.map(s => s.name);
  }, [descriptor]);

  if (loading) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-[var(--bg-page)]">
        <div className="w-8 h-8 border-2 border-[var(--navy)] border-t-transparent rounded-full spin" />
        <p className="mt-3 text-sm text-[var(--text-tertiary)]">Loading template...</p>
      </div>
    );
  }

  if (error || !descriptor) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-[var(--bg-page)]">
        <p className="text-sm text-red-600">Failed to load template: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-page)]">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 bg-white border-b border-[var(--border)] excel-scroll flex-shrink-0">
        <span className="flex-shrink-0 px-2 py-0.5 mr-1 rounded text-[9px] font-bold uppercase tracking-[0.06em]"
          style={{ background: `${T.navy}0D`, color: T.navy }}>
          Inputs
        </span>
        {INPUT_SHEETS.filter(n => allSheetNames.includes(n)).map(name => (
          <TabBtn key={name} name={name} active={(activeSheetObj?.name || activeSheet) === name}
            flash={flashingSheet === name} onClick={() => setActiveSheet(name)} />
        ))}
        <div className="flex-shrink-0 w-px h-5 bg-[var(--border)] mx-1" />
        <span className="flex-shrink-0 px-2 py-0.5 mr-1 rounded text-[9px] font-bold uppercase tracking-[0.06em]"
          style={{ background: `${T.teal}0D`, color: T.teal }}>
          Outputs
        </span>
        {OUTPUT_SHEETS.filter(n => allSheetNames.includes(n)).map(name => (
          <TabBtn key={name} name={name} active={(activeSheetObj?.name || activeSheet) === name}
            flash={flashingSheet === name} onClick={() => setActiveSheet(name)} color={T.teal} />
        ))}
      </div>

      {/* ── Color legend bar ── */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-white border-b border-[var(--border)] flex-shrink-0">
        <LegendDot color={T.input} label="Input (editable)" />
        <LegendDot color={T.formula} label="Formula (auto)" />
        <LegendDot color={T.link} label="Cross-sheet link" />
        <LegendDot color={T.header} label="Header" textColor="#fff" />
      </div>

      {/* ── Sheet grid ── */}
      <div className="flex-1 overflow-auto excel-scroll">
        {activeSheetObj && engine && (
          <SheetGrid
            sheet={activeSheetObj}
            engine={engine}
            overrides={templateOverrides}
            onCellEdit={setTemplateCell}
          />
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Tab Button
   ════════════════════════════════════════════════════════ */
function TabBtn({ name, active, flash, onClick, color = T.navy }) {
  const display = shortName(name);
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap transition-all"
      style={{
        background: active ? color : flash ? '#F0FDF4' : 'transparent',
        color: active ? '#fff' : flash ? T.green : T.t2,
        boxShadow: active ? `0 2px 6px ${color}35` : 'none',
      }}
    >
      {display}
    </button>
  );
}

/* ════════════════════════════════════════════════════════
   Legend dot
   ════════════════════════════════════════════════════════ */
function LegendDot({ color, label, textColor }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm border border-gray-300"
        style={{ background: color, color: textColor }} />
      <span className="text-[10px] text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Sheet Grid — renders a single sheet as an HTML table
   ════════════════════════════════════════════════════════ */
function SheetGrid({ sheet, engine, overrides, onCellEdit }) {
  const mergeMap = useMemo(() => buildMergeMap(sheet.merges), [sheet.merges]);

  // Column widths
  const colWidths = useMemo(() => {
    const map = {};
    if (sheet.colWidths) {
      for (const [col, w] of sheet.colWidths) {
        map[col] = colWidthToPx(w);
      }
    }
    return map;
  }, [sheet.colWidths]);

  // Build column list from data
  const colList = useMemo(() => {
    const cols = new Set();
    for (const row of sheet.rows) {
      for (const cell of row.cells) {
        const m = cell.a.match(/^([A-Z]+)/);
        if (m) cols.add(m[1]);
      }
    }
    return Array.from(cols).sort((a, b) => colToIdx(a) - colToIdx(b));
  }, [sheet.rows]);

  return (
    <div className="p-3">
      <table className="border-collapse text-[11px] leading-tight"
        style={{ minWidth: '100%', tableLayout: 'fixed' }}>
        {/* Column header row (A, B, C...) */}
        <thead>
          <tr>
            <th className="sticky top-0 z-10 px-1 py-1 text-[9px] text-center font-normal border border-gray-200"
              style={{ background: '#F1F5F9', width: 28, minWidth: 28, color: T.t3 }}>
            </th>
            {colList.map(col => (
              <th key={col}
                className="sticky top-0 z-10 px-1 py-1 text-[9px] text-center font-normal border border-gray-200"
                style={{
                  background: '#F1F5F9',
                  width: colWidths[col] || 64,
                  minWidth: colWidths[col] || 64,
                  color: T.t3,
                }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row) => (
            <SheetRow
              key={row.r}
              row={row}
              colList={colList}
              mergeMap={mergeMap}
              engine={engine}
              sheetName={sheet.name}
              overrides={overrides?.[sheet.name] || {}}
              onCellEdit={onCellEdit}
              colWidths={colWidths}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Sheet Row
   ════════════════════════════════════════════════════════ */
function SheetRow({ row, colList, mergeMap, engine, sheetName, overrides, onCellEdit, colWidths }) {
  // Build a quick lookup of cells in this row
  const cellByCol = useMemo(() => {
    const map = {};
    for (const cell of row.cells) {
      const m = cell.a.match(/^([A-Z]+)/);
      if (m) map[m[1]] = cell;
    }
    return map;
  }, [row.cells]);

  return (
    <tr style={{ height: row.h ? Math.max(18, row.h * 1.1) : 22 }}>
      {/* Row number gutter */}
      <td className="px-1 py-0 text-[9px] text-center border border-gray-200 select-none"
        style={{ background: '#F1F5F9', color: T.t3, width: 28, minWidth: 28 }}>
        {row.r}
      </td>
      {colList.map(col => {
        const addr = col + row.r;
        const cell = cellByCol[col];
        const merge = mergeMap[addr];

        // Hidden by merge
        if (merge === 'hidden') return null;

        if (!cell) {
          // Empty cell
          return (
            <td key={col}
              className="px-1 py-0 border border-gray-200"
              style={{ background: '#fff' }}
              {...(merge && merge !== 'hidden' ? { rowSpan: merge.rowSpan, colSpan: merge.colSpan } : {})}
            />
          );
        }

        return (
          <CellTd
            key={col}
            cell={cell}
            merge={merge}
            engine={engine}
            sheetName={sheetName}
            override={overrides[addr]}
            onEdit={(val) => onCellEdit(sheetName, addr, val)}
          />
        );
      })}
    </tr>
  );
}

/* ════════════════════════════════════════════════════════
   Cell <td>
   ════════════════════════════════════════════════════════ */
function CellTd({ cell, merge, engine, sheetName, override, onEdit }) {
  const cellRef = useRef(null);
  const [editing, setEditing] = useState(false);

  const isInput = isInputCell(cell);
  const isFormula = isFormulaCell(cell);
  const isHdr = isHeaderCell(cell);

  // Determine display value
  const displayValue = useMemo(() => {
    // For formula cells, use engine-computed value
    if (cell.f && engine) {
      const computed = engine.getCellValue(sheetName, cell.a);
      return formatCellValue(computed, cell.nf);
    }
    // For input cells with override
    if (override !== undefined) {
      return formatCellValue(override, cell.nf);
    }
    // Original value
    if (cell.v !== undefined && cell.v !== null) {
      if (cell.nf) return formatCellValue(cell.v, cell.nf);
      return String(cell.v);
    }
    return '';
  }, [cell, engine, sheetName, override]);

  // Raw value for editing (unformatted)
  const rawValue = useMemo(() => {
    if (override !== undefined) return override;
    if (cell.f && engine) return engine.getCellValue(sheetName, cell.a);
    return cell.v ?? '';
  }, [cell, engine, sheetName, override]);

  const bg = getCellBg(cell);
  const color = getCellColor(cell);
  const align = cell.ah === 'center' ? 'center' : cell.ah === 'right' ? 'right' : 'left';

  const handleBlur = useCallback((e) => {
    setEditing(false);
    if (!isInput) return;
    const text = e.target.textContent?.trim() ?? '';
    // Try to parse as number
    const num = Number(text.replace(/[,\s\u20B9%]/g, ''));
    const newVal = isNaN(num) ? text : num;
    if (newVal !== rawValue) {
      onEdit(newVal);
    }
  }, [isInput, rawValue, onEdit]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
    if (e.key === 'Escape') {
      e.target.textContent = displayValue;
      e.target.blur();
    }
  }, [displayValue]);

  const handleFocus = useCallback(() => {
    if (isInput) {
      setEditing(true);
      // Show raw value when editing
      if (cellRef.current) {
        cellRef.current.textContent = rawValue === 0 ? '' : String(rawValue);
        // Select all
        const range = document.createRange();
        range.selectNodeContents(cellRef.current);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [isInput, rawValue]);

  const mergeProps = merge && merge !== 'hidden'
    ? { rowSpan: merge.rowSpan, colSpan: merge.colSpan }
    : {};

  return (
    <td
      ref={cellRef}
      className={`px-1.5 py-0.5 border border-gray-200 truncate ${
        isInput ? 'cursor-text hover:ring-2 hover:ring-blue-300 hover:ring-inset' : ''
      } ${isFormula ? 'font-num' : ''}`}
      style={{
        background: editing ? '#FFFDE7' : bg,
        color: color,
        fontSize: cell.fs ? Math.min(cell.fs, 14) : 11,
        fontWeight: cell.b ? 700 : 400,
        textAlign: align,
        whiteSpace: cell.wrap ? 'pre-wrap' : 'nowrap',
        overflow: 'hidden',
        maxWidth: 400,
        outline: 'none',
      }}
      contentEditable={isInput}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      title={cell.f ? `Formula: ${cell.f}` : (isInput ? 'Click to edit' : '')}
      {...mergeProps}
    >
      {displayValue}
    </td>
  );
}
