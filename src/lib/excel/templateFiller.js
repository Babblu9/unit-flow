/**
 * templateFiller.js — Fills the gold-standard Excel template with AI + user values
 *
 * Two download modes:
 *   1. "with formulas" (default) — Clones the template .xlsx, writes only input cell values.
 *      All 2,395 formulas remain intact. Excel recalculates on open.
 *   2. "without formulas" — Same as above, but also replaces every formula cell with its
 *      computed value (from FormulaEngine). No formulas remain; pure values.
 *
 * Usage:
 *   const buffer = await fillTemplate(overrides, { mode: 'formulas' });
 *   // or
 *   const buffer = await fillTemplate(overrides, { mode: 'values', descriptor, engine });
 */

import ExcelJS from 'exceljs';
import path from 'path';
import { readFile } from 'fs/promises';

const TEMPLATE_PATH = path.join(process.cwd(), 'BlueLeaveFarms_UnitEconomics_V4_FINAL.xlsx');

/**
 * Fill the template Excel with overrides.
 *
 * @param {Object} overrides — { sheetName: { cellAddr: value } } from cellMapper + user edits
 * @param {Object} options
 * @param {'formulas'|'values'} options.mode — 'formulas' preserves formulas, 'values' bakes everything
 * @param {Object} [options.descriptor] — Required for 'values' mode
 * @param {FormulaEngine} [options.engine] — Required for 'values' mode
 * @param {string} [options.companyName] — For file naming
 * @returns {Promise<Buffer>} — xlsx file buffer
 */
export async function fillTemplate(overrides, options = {}) {
  const { mode = 'formulas', descriptor, engine, companyName } = options;

  // Read the template file
  const templateBuffer = await readFile(TEMPLATE_PATH);

  // Load workbook
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);

  // ── CRITICAL: Clear ALL green input cells BEFORE applying overrides ──
  // This zeroes out every Blue Leaves Farms value in the template so
  // no stale data bleeds through for cells the AI doesn't explicitly fill.
  clearAllInputCells(wb);

  // Apply overrides to input cells
  for (const [sheetName, cells] of Object.entries(overrides)) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) {
      console.warn(`templateFiller: Sheet "${sheetName}" not found in template`);
      continue;
    }

    for (const [addr, value] of Object.entries(cells)) {
      const cell = ws.getCell(addr);
      // Only write to non-formula cells (input cells)
      // In 'formulas' mode, skip cells that already have formulas
      if (mode === 'formulas' && cell.formula) {
        // Don't overwrite formula cells — just set input values
        continue;
      }
      setCellValue(cell, value);
    }
  }

  // In 'values' mode, bake all formulas to computed values
  if (mode === 'values' && descriptor && engine) {
    for (const sheet of descriptor.sheets) {
      const ws = wb.getWorksheet(sheet.name);
      if (!ws) continue;

      for (const row of sheet.rows) {
        for (const cellDesc of row.cells) {
          if (cellDesc.f) {
            // This cell has a formula — replace with computed value
            const computed = engine.getCellValue(sheet.name, cellDesc.a);
            const cell = ws.getCell(cellDesc.a);
            // Remove formula, set value
            cell.value = typeof computed === 'number' ? computed : (computed || 0);
          }
        }
      }
    }
  }

  // Update company name in title cells if provided
  if (companyName) {
    const titleSheets = [
      { sheet: 'Instructions & Guide', cell: 'A2' },
      { sheet: '1. Unit Economics - HR Costs', cell: 'A2' },
    ];
    for (const { sheet, cell: addr } of titleSheets) {
      const ws = wb.getWorksheet(sheet);
      if (ws) {
        const cell = ws.getCell(addr);
        const current = cell.value?.toString() || '';
        if (current.includes('Blue Leave Farms') || current.includes('BLUE LEAVE')) {
          cell.value = current.replace(/Blue Leave Farms|BLUE LEAVE FARMS/gi, companyName);
        }
      }
    }
  }

  // Force Excel to recalculate formulas on open
  wb.calcProperties = { fullCalcOnLoad: true };

  // Write to buffer
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Clear ALL green input cells (FFC6EFCE background) across all sheets.
 *
 * This treats the template as a blank base — every input cell is zeroed out
 * before the AI's overrides are applied. Numbers become 0, strings become ''.
 * Formula cells are NEVER touched (they recalculate in Excel).
 *
 * Also clears label cells in known data rows (product names, designations, etc.)
 * that have NO fill but sit adjacent to green input cells. These are handled by
 * cellMapper writing '' to them, but as a safety net we also clear cells with
 * a light blue formula fill (FFBDD7EE / FFD6E4F0) ONLY if they are NOT formula cells.
 */
const INPUT_GREEN = 'FFC6EFCE';

function clearAllInputCells(wb) {
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        // Never touch formula cells — they must remain intact
        if (cell.formula || cell.sharedFormula) return;

        const fill = cell.fill;
        if (!fill || fill.type !== 'pattern') return;

        const argb = fill.fgColor?.argb;
        if (argb === INPUT_GREEN) {
          // Green input cell — clear to appropriate zero value
          if (typeof cell.value === 'string') {
            cell.value = '';
          } else {
            cell.value = 0;
          }
        }
      });
    });
  }
}

/**
 * Set a cell value, preserving number formats.
 */
function setCellValue(cell, value) {
  if (value === null || value === undefined) {
    cell.value = null;
    return;
  }

  if (typeof value === 'number') {
    cell.value = value;
  } else if (typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      cell.value = num;
    } else {
      cell.value = value;
    }
  } else {
    cell.value = value;
  }
}

export default fillTemplate;
