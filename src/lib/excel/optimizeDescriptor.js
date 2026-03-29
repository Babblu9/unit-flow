/**
 * optimizeDescriptor.js — Slim down templateDescriptor.json for browser use
 *
 * Removes: merged-cell duplicates, verbose border info, null fields
 * Keeps: cell addr, type, value/formula, fill color, font basics, numFmt, merges
 *
 * Run: node src/lib/excel/optimizeDescriptor.js
 */

const fs = require('fs');
const path = require('path');

const desc = require('./templateDescriptor.json');

function parseMerge(mergeStr) {
  // "A1:T1" → { startCol: 'A', startRow: 1, endCol: 'T', endRow: 1 }
  const [start, end] = mergeStr.split(':');
  const parseAddr = (a) => {
    const m = a.match(/^([A-Z]+)(\d+)$/);
    return { col: m[1], row: parseInt(m[2]) };
  };
  return { start: parseAddr(start), end: parseAddr(end) };
}

function isInMerge(addr, merges) {
  // Returns the master cell address if addr is a slave cell in a merge, else null
  for (const merge of merges) {
    const { start, end } = parseMerge(merge);
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    const col = m[1], row = parseInt(m[2]);
    if (row >= start.row && row <= end.row && col >= start.col && col <= end.col) {
      const masterAddr = start.col + start.row;
      if (addr !== masterAddr) return masterAddr;
    }
  }
  return null;
}

const optimized = {
  version: desc.version,
  sourceFile: desc.sourceFile,
  sheets: [],
};

let totalOrigCells = 0;
let totalOptCells = 0;

for (const sheet of desc.sheets) {
  const optSheet = {
    name: sheet.name,
    rowCount: sheet.rowCount,
    colCount: sheet.columnCount,
    merges: sheet.merges,
    colWidths: sheet.columnWidths.map(cw => [cw.col, Math.round(cw.width * 10) / 10]),
    rows: [],
  };

  // Build a set of master merge addresses so we can identify slave cells
  const mergeSlaves = new Set();
  for (const merge of sheet.merges) {
    const { start, end } = parseMerge(merge);
    const startColCode = start.col.charCodeAt(0);
    const endColCode = end.col.charCodeAt(0);
    for (let r = start.row; r <= end.row; r++) {
      for (let c = startColCode; c <= endColCode; c++) {
        const addr = String.fromCharCode(c) + r;
        const master = start.col + start.row;
        if (addr !== master) mergeSlaves.add(addr);
      }
    }
  }

  for (const row of sheet.rows) {
    const optRow = { r: row.row, cells: [] };
    if (row.height) optRow.h = row.height;

    for (const cell of row.cells) {
      totalOrigCells++;

      // Skip slave cells of merges (they duplicate the master)
      if (mergeSlaves.has(cell.addr)) continue;

      totalOptCells++;

      // Build compact cell: [addr, type, value|formula, fill?, font_bold?, numFmt?]
      const c = { a: cell.addr, t: cell.type };
      if (cell.value !== undefined) c.v = cell.value;
      if (cell.formula) c.f = cell.formula;
      if (cell.fill) c.bg = cell.fill;
      if (cell.computed !== undefined) c.cv = cell.computed;
      if (cell.font) {
        if (cell.font.bold) c.b = true;
        if (cell.font.color) c.fc = cell.font.color;
        if (cell.font.size) c.fs = cell.font.size;
      }
      if (cell.numFmt) c.nf = cell.numFmt;
      if (cell.align) {
        if (cell.align.horizontal) c.ah = cell.align.horizontal;
        if (cell.align.wrapText) c.wrap = true;
      }

      optRow.cells.push(c);
    }

    if (optRow.cells.length > 0) {
      optSheet.rows.push(optRow);
    }
  }

  optimized.sheets.push(optSheet);
}

const outputPath = path.resolve(__dirname, 'templateDescriptor.opt.json');
const json = JSON.stringify(optimized);
fs.writeFileSync(outputPath, json);

console.log(`Original cells: ${totalOrigCells}`);
console.log(`Optimized cells: ${totalOptCells} (removed ${totalOrigCells - totalOptCells} merge duplicates)`);
console.log(`Output: ${outputPath} (${(json.length / 1024).toFixed(1)} KB)`);
