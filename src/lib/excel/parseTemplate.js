/**
 * parseTemplate.js — One-time template parser
 *
 * Reads BlueLeaveFarms_UnitEconomics_V4_FINAL.xlsx and produces a complete
 * JSON descriptor of every sheet, cell, formula, and formatting rule.
 *
 * Run:  node src/lib/excel/parseTemplate.js
 * Output: src/lib/excel/templateDescriptor.json
 *
 * The descriptor is the single source of truth for:
 *   - HTML rendering (TemplateViewer)
 *   - Cell mapping (AI data → cell addresses)
 *   - Download (clone template + fill values)
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/* ── Color → cell type mapping ── */
const CELL_TYPES = {
  FFC6EFCE: 'input',     // Green — user editable
  FFBDD7EE: 'formula',   // Light blue — auto-calculated
  FFD6E4F0: 'crossref',  // Lighter blue — cross-sheet reference
  FF1F4E79: 'header',    // Dark navy — section headers
  FF2C5F8A: 'subheader', // Medium blue — column headers variant
  FFB4C6E7: 'subtotal',  // Medium blue — subtotal rows
};

function getCellType(cell) {
  const fill = cell.fill;
  if (!fill) return 'label';

  let argb = null;
  if (fill.type === 'pattern' && fill.pattern === 'solid') {
    if (fill.fgColor && fill.fgColor.argb) argb = fill.fgColor.argb;
    else if (fill.bgColor && fill.bgColor.argb) argb = fill.bgColor.argb;
  }

  if (argb && CELL_TYPES[argb]) return CELL_TYPES[argb];

  // Check if it has a formula regardless of color
  if (cell.formula || cell.sharedFormula) return 'formula';

  return 'label';
}

function getFillColor(cell) {
  const fill = cell.fill;
  if (!fill || fill.type !== 'pattern' || fill.pattern !== 'solid') return null;
  if (fill.fgColor && fill.fgColor.argb) return fill.fgColor.argb;
  if (fill.bgColor && fill.bgColor.argb) return fill.bgColor.argb;
  return null;
}

function getFontInfo(cell) {
  const font = cell.font;
  if (!font) return null;
  const info = {};
  if (font.bold) info.bold = true;
  if (font.italic) info.italic = true;
  if (font.size) info.size = font.size;
  if (font.color && font.color.argb) info.color = font.color.argb;
  if (font.name) info.name = font.name;
  return Object.keys(info).length > 0 ? info : null;
}

function getAlignment(cell) {
  const align = cell.alignment;
  if (!align) return null;
  const info = {};
  if (align.horizontal) info.horizontal = align.horizontal;
  if (align.vertical) info.vertical = align.vertical;
  if (align.wrapText) info.wrapText = true;
  return Object.keys(info).length > 0 ? info : null;
}

function getBorders(cell) {
  const border = cell.border;
  if (!border) return null;
  const info = {};
  for (const side of ['top', 'bottom', 'left', 'right']) {
    if (border[side] && border[side].style) {
      info[side] = { style: border[side].style };
      if (border[side].color && border[side].color.argb) {
        info[side].color = border[side].color.argb;
      }
    }
  }
  return Object.keys(info).length > 0 ? info : null;
}

function getNumberFormat(cell) {
  if (cell.numFmt && cell.numFmt !== 'General') return cell.numFmt;
  return null;
}

function getCellValue(cell) {
  if (cell.formula) return null; // formula cells don't store a static value
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.richText) {
    return v.richText.map(t => t.text).join('');
  }
  if (typeof v === 'object' && v.result !== undefined) {
    return v.result;
  }
  return v;
}

function colToLetter(col) {
  let letter = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

async function parseTemplate() {
  const templatePath = path.resolve(__dirname, '../../../BlueLeaveFarms_UnitEconomics_V4_FINAL.xlsx');
  const outputPath = path.resolve(__dirname, 'templateDescriptor.json');

  console.log('Reading template:', templatePath);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  const descriptor = {
    version: '1.0',
    sourceFile: 'BlueLeaveFarms_UnitEconomics_V4_FINAL.xlsx',
    generatedAt: new Date().toISOString(),
    sheets: [],
  };

  for (const ws of wb.worksheets) {
    const sheetDesc = {
      name: ws.name,
      rowCount: ws.rowCount,
      columnCount: ws.columnCount,
      merges: ws.model.merges || [],
      columnWidths: [],
      rows: [],
    };

    // Capture column widths
    for (let c = 1; c <= ws.columnCount; c++) {
      const col = ws.getColumn(c);
      sheetDesc.columnWidths.push({
        col: colToLetter(c),
        width: col.width || 10,
      });
    }

    // Parse every row
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rowDesc = {
        row: r,
        height: row.height || null,
        cells: [],
      };

      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = row.getCell(c);
        const colLetter = colToLetter(c);
        const addr = colLetter + r;

        const formula = cell.formula || null;
        const value = getCellValue(cell);
        const cellType = getCellType(cell);
        const fillColor = getFillColor(cell);
        const font = getFontInfo(cell);
        const alignment = getAlignment(cell);
        const borders = getBorders(cell);
        const numFmt = getNumberFormat(cell);

        // Skip truly empty cells (no value, no formula, no fill, no font)
        if (value === null && !formula && !fillColor && !font && !borders) continue;

        const cellDesc = {
          addr,
          col: colLetter,
          row: r,
          type: cellType,
        };

        if (value !== null) cellDesc.value = value;
        if (formula) cellDesc.formula = formula;
        if (fillColor) cellDesc.fill = fillColor;
        if (font) cellDesc.font = font;
        if (alignment) cellDesc.align = alignment;
        if (borders) cellDesc.border = borders;
        if (numFmt) cellDesc.numFmt = numFmt;

        // If formula cell, store the computed result too
        if (formula && cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
          cellDesc.computed = cell.value.result;
        }

        rowDesc.cells.push(cellDesc);
      }

      // Only include rows with cells
      if (rowDesc.cells.length > 0) {
        sheetDesc.rows.push(rowDesc);
      }
    }

    descriptor.sheets.push(sheetDesc);
    console.log(`  Parsed: "${ws.name}" — ${sheetDesc.rows.length} rows with data`);
  }

  // Write the descriptor
  const json = JSON.stringify(descriptor, null, 2);
  fs.writeFileSync(outputPath, json);
  console.log(`\nDescriptor written: ${outputPath} (${(json.length / 1024).toFixed(1)} KB)`);

  // Also write a compact version (no whitespace) for production
  const compactPath = path.resolve(__dirname, 'templateDescriptor.min.json');
  fs.writeFileSync(compactPath, JSON.stringify(descriptor));
  console.log(`Compact version: ${compactPath} (${(JSON.stringify(descriptor).length / 1024).toFixed(1)} KB)`);

  return descriptor;
}

// Run directly
parseTemplate().catch(console.error);
