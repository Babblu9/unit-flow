/**
 * formulaEngine.js — Client-side formula evaluator for the template descriptor
 *
 * Evaluates Excel formulas from the JSON descriptor using cell values (original + overrides).
 * Supports: basic arithmetic, SUM, AVERAGE, IF, MIN, MAX, ROUND, ABS, PMT, CHOOSE,
 * cross-sheet references (e.g. '1. Unit Economics - HR Costs'!U6), cell ranges (A1:A10).
 *
 * Limitations:
 * - Does not handle array formulas or VLOOKUP/INDEX/MATCH
 * - PMT is simplified (standard financial formula)
 * - CHOOSE supports up to 6 choices (enough for 6 cities)
 *
 * Usage:
 *   const engine = new FormulaEngine(descriptor, overrides);
 *   engine.evaluateAll();
 *   const val = engine.getCellValue(sheetName, 'J6');
 */

// ── Column utilities ──
function colToIndex(col) {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx;
}

function indexToCol(idx) {
  let col = '';
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    idx = Math.floor((idx - 1) / 26);
  }
  return col;
}

function parseRef(ref) {
  const m = ref.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
  if (!m) return null;
  return { col: m[2], row: parseInt(m[4], 10) };
}

function expandRange(rangeStr) {
  const [startRef, endRef] = rangeStr.split(':');
  const start = parseRef(startRef);
  const end = parseRef(endRef);
  if (!start || !end) return [];

  const cells = [];
  const startCol = colToIndex(start.col);
  const endCol = colToIndex(end.col);
  for (let r = start.row; r <= end.row; r++) {
    for (let c = startCol; c <= endCol; c++) {
      cells.push(`${indexToCol(c)}${r}`);
    }
  }
  return cells;
}

export class FormulaEngine {
  constructor(descriptor, overrides = {}) {
    this.descriptor = descriptor;
    this.overrides = overrides;
    // Build lookup: { sheetName: { cellAddr: cellObj } }
    this.cellMap = {};
    // Computed values cache: { sheetName: { cellAddr: number|string } }
    this.computed = {};
    // Build index
    this._buildIndex();
  }

  _buildIndex() {
    for (const sheet of this.descriptor.sheets) {
      this.cellMap[sheet.name] = {};
      this.computed[sheet.name] = {};
      for (const row of sheet.rows) {
        for (const cell of row.cells) {
          this.cellMap[sheet.name][cell.a] = cell;
        }
      }
    }
  }

  /**
   * Get effective value for a cell (override > formula > original value)
   */
  getCellValue(sheetName, addr) {
    // Check overrides first
    if (this.overrides[sheetName] && this.overrides[sheetName][addr] !== undefined) {
      const ov = this.overrides[sheetName][addr];
      return typeof ov === 'string' ? (isNaN(Number(ov)) ? ov : Number(ov)) : ov;
    }

    // Check computed cache
    if (this.computed[sheetName] && this.computed[sheetName][addr] !== undefined) {
      return this.computed[sheetName][addr];
    }

    // Get from descriptor
    const cell = this.cellMap[sheetName]?.[addr];
    if (!cell) return 0;

    // If it has a formula, evaluate it
    if (cell.f) {
      const val = this._evalFormula(cell.f, sheetName);
      this.computed[sheetName][addr] = val;
      return val;
    }

    // Return stored value
    const v = cell.v;
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    const n = Number(v);
    return isNaN(n) ? v : n;
  }

  /**
   * Evaluate all formula cells across all sheets (topological order would be ideal,
   * but we use a multi-pass approach for simplicity — 3 passes handles most deps).
   */
  evaluateAll() {
    // Clear computed cache
    for (const sheet of this.descriptor.sheets) {
      this.computed[sheet.name] = {};
    }

    // Multi-pass evaluation (3 passes to resolve cross-sheet deps)
    for (let pass = 0; pass < 3; pass++) {
      for (const sheet of this.descriptor.sheets) {
        for (const row of sheet.rows) {
          for (const cell of row.cells) {
            if (cell.f) {
              // Only for formula/crossref/subtotal cells
              try {
                const val = this._evalFormula(cell.f, sheet.name);
                this.computed[sheet.name][cell.a] = val;
              } catch {
                // Keep previous computed value or cv
                if (this.computed[sheet.name][cell.a] === undefined) {
                  this.computed[sheet.name][cell.a] = cell.cv ?? 0;
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Re-evaluate only cells affected by a change in a specific sheet/cell.
   * For performance, we do a single full pass (simpler than dependency tracking).
   */
  recomputeFrom(sheetName, addr) {
    // Clear computed cache and re-evaluate all
    // (Full recompute is fast enough for ~2400 formulas)
    this.evaluateAll();
  }

  /**
   * Update overrides and recompute
   */
  updateOverrides(newOverrides) {
    this.overrides = newOverrides;
    this.evaluateAll();
  }

  /**
   * Evaluate a single formula string in the context of a sheet.
   */
  _evalFormula(formula, currentSheet) {
    try {
      // Normalize: remove leading =
      let f = formula.startsWith('=') ? formula.slice(1) : formula;

      // Replace cross-sheet references: 'Sheet Name'!A1 → __crossRef('Sheet Name', 'A1')
      f = f.replace(/'([^']+)'!([A-Z]+\d+(?::[A-Z]+\d+)?)/g, (_, sheet, ref) => {
        if (ref.includes(':')) {
          return `__rangeRef('${sheet}','${ref}')`;
        }
        return `__cellRef('${sheet}','${ref}')`;
      });

      // Replace same-sheet ranges in function args: SUM(A1:A10) → SUM(__range('A1:A10'))
      // But first handle ranges not already wrapped
      f = f.replace(/\b([A-Z]+\d+):([A-Z]+\d+)\b/g, (match) => {
        return `__range('${match}')`;
      });

      // Replace cell references: A1, B5, $A$1 etc → __cell('A1')
      f = f.replace(/\$?([A-Z]+)\$?(\d+)/g, (match, col, row) => {
        // Don't replace if inside quotes or already a function call
        return `__cell('${col}${row}')`;
      });

      // Build evaluation context
      const ctx = this._buildContext(currentSheet);

      // Execute
      const fn = new Function(...Object.keys(ctx), `"use strict"; return (${f});`);
      const result = fn(...Object.values(ctx));

      if (typeof result === 'number' && !isFinite(result)) return 0;
      return typeof result === 'number' ? result : (result ?? 0);
    } catch {
      return 0;
    }
  }

  /**
   * Build evaluation context with helper functions.
   */
  _buildContext(currentSheet) {
    const self = this;

    const __cell = (addr) => {
      return self.getCellValue(currentSheet, addr);
    };

    const __cellRef = (sheet, addr) => {
      return self.getCellValue(sheet, addr);
    };

    const __range = (rangeStr) => {
      return expandRange(rangeStr).map(addr => self.getCellValue(currentSheet, addr));
    };

    const __rangeRef = (sheet, rangeStr) => {
      return expandRange(rangeStr).map(addr => self.getCellValue(sheet, addr));
    };

    // Excel functions
    const SUM = (...args) => {
      let total = 0;
      for (const a of args) {
        if (Array.isArray(a)) {
          for (const v of a) {
            const n = typeof v === 'number' ? v : Number(v);
            if (!isNaN(n)) total += n;
          }
        } else {
          const n = typeof a === 'number' ? a : Number(a);
          if (!isNaN(n)) total += n;
        }
      }
      return total;
    };

    const AVERAGE = (...args) => {
      let total = 0, count = 0;
      for (const a of args) {
        if (Array.isArray(a)) {
          for (const v of a) {
            const n = typeof v === 'number' ? v : Number(v);
            if (!isNaN(n)) { total += n; count++; }
          }
        } else {
          const n = typeof a === 'number' ? a : Number(a);
          if (!isNaN(n)) { total += n; count++; }
        }
      }
      return count > 0 ? total / count : 0;
    };

    const IF = (cond, thenVal, elseVal) => cond ? thenVal : elseVal;

    const MIN = (...args) => {
      const flat = args.flat(Infinity).map(v => typeof v === 'number' ? v : Number(v)).filter(n => !isNaN(n));
      return flat.length > 0 ? Math.min(...flat) : 0;
    };

    const MAX = (...args) => {
      const flat = args.flat(Infinity).map(v => typeof v === 'number' ? v : Number(v)).filter(n => !isNaN(n));
      return flat.length > 0 ? Math.max(...flat) : 0;
    };

    const ROUND = (num, digits) => {
      const n = typeof num === 'number' ? num : Number(num);
      const d = typeof digits === 'number' ? digits : Number(digits);
      if (isNaN(n)) return 0;
      const factor = Math.pow(10, d || 0);
      return Math.round(n * factor) / factor;
    };

    const ROUNDUP = (num, digits) => {
      const n = typeof num === 'number' ? num : Number(num);
      const d = typeof digits === 'number' ? digits : Number(digits);
      if (isNaN(n)) return 0;
      const factor = Math.pow(10, d || 0);
      return Math.ceil(n * factor) / factor;
    };

    const ABS = (num) => Math.abs(typeof num === 'number' ? num : Number(num) || 0);

    // PMT(rate, nper, pv) — standard Excel PMT (payment per period)
    const PMT = (rate, nper, pv) => {
      const r = Number(rate) || 0;
      const n = Number(nper) || 0;
      const p = Number(pv) || 0;
      if (r === 0) return n > 0 ? -p / n : 0;
      return -(p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    };

    // CHOOSE(index, val1, val2, ...) — 1-based
    const CHOOSE = (index, ...values) => {
      const idx = Math.floor(Number(index) || 0);
      if (idx < 1 || idx > values.length) return 0;
      return values[idx - 1];
    };

    const SUMPRODUCT = (...args) => {
      if (args.length === 0) return 0;
      // All args should be arrays of same length
      const arrays = args.map(a => Array.isArray(a) ? a : [a]);
      const len = Math.max(...arrays.map(a => a.length));
      let sum = 0;
      for (let i = 0; i < len; i++) {
        let product = 1;
        for (const arr of arrays) {
          const v = i < arr.length ? (typeof arr[i] === 'number' ? arr[i] : Number(arr[i]) || 0) : 0;
          product *= v;
        }
        sum += product;
      }
      return sum;
    };

    const IFERROR = (value, fallback) => {
      try {
        const v = typeof value === 'function' ? value() : value;
        if (typeof v === 'number' && !isFinite(v)) return fallback;
        return v;
      } catch {
        return fallback;
      }
    };

    const COUNT = (...args) => {
      let count = 0;
      for (const a of args) {
        if (Array.isArray(a)) {
          for (const v of a) {
            if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v !== '')) count++;
          }
        } else {
          if (typeof a === 'number' || (typeof a === 'string' && !isNaN(Number(a)) && a !== '')) count++;
        }
      }
      return count;
    };

    const COUNTA = (...args) => {
      let count = 0;
      for (const a of args) {
        if (Array.isArray(a)) {
          for (const v of a) {
            if (v !== null && v !== undefined && v !== '' && v !== 0) count++;
          }
        } else {
          if (a !== null && a !== undefined && a !== '' && a !== 0) count++;
        }
      }
      return count;
    };

    // Boolean operators for formula evaluation
    const AND = (...args) => args.flat(Infinity).every(Boolean);
    const OR = (...args) => args.flat(Infinity).some(Boolean);
    const NOT = (val) => !val;

    return {
      __cell, __cellRef, __range, __rangeRef,
      SUM, AVERAGE, IF, MIN, MAX, ROUND, ROUNDUP, ABS,
      PMT, CHOOSE, SUMPRODUCT, IFERROR, COUNT, COUNTA,
      AND, OR, NOT,
      TRUE: true, FALSE: false,
      Math,
    };
  }
}

/**
 * Format a numeric value according to an Excel number format string.
 */
export function formatCellValue(value, numberFormat) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && isNaN(Number(value))) return value;

  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return String(value);

  if (!numberFormat || numberFormat === 'General') {
    // Default: reasonable decimal places
    if (Number.isInteger(num)) return num.toLocaleString('en-IN');
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  // Percentage formats
  if (numberFormat.includes('%')) {
    const pct = num * 100;
    if (numberFormat === '0%') return `${Math.round(pct)}%`;
    if (numberFormat === '0.0%') return `${pct.toFixed(1)}%`;
    if (numberFormat === '0.00%') return `${pct.toFixed(2)}%`;
    return `${pct.toFixed(1)}%`;
  }

  // Currency formats with Indian numbering
  if (numberFormat.includes('\u20B9') || numberFormat.includes('#,##0')) {
    const decimals = (numberFormat.match(/\.0+/) || [''])[0].length - 1;
    const d = Math.max(0, decimals);
    const formatted = num.toLocaleString('en-IN', {
      minimumFractionDigits: d > 0 ? d : 0,
      maximumFractionDigits: d > 0 ? d : 0,
    });
    if (numberFormat.includes('\u20B9')) return `\u20B9${formatted}`;
    return formatted;
  }

  // Decimal formats
  if (numberFormat.match(/^0\.0+$/)) {
    const d = numberFormat.split('.')[1].length;
    return num.toFixed(d);
  }

  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
