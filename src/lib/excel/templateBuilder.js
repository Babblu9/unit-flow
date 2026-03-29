/**
 * ExcelJS template builder for the 17-sheet Unit Economics model.
 * Generates a fully formatted, formula-linked .xlsx workbook.
 *
 * Color scheme:
 *   Dark Navy #1F4E79 headers with white text
 *   Light Green #C6EFCE for inputs with blue text #0000FF
 *   Light Blue #BDD7EE for formulas with black text
 *   Lighter Blue #D6E4F0 for cross-sheet links
 */
import ExcelJS from 'exceljs';

/* ── Style constants ── */
const STYLES = {
  headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } },
  headerFont: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' },
  inputFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } },
  inputFont: { color: { argb: 'FF0000FF' }, size: 11, name: 'Calibri' },
  formulaFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } },
  formulaFont: { color: { argb: 'FF000000' }, size: 11, name: 'Calibri' },
  crossRefFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } },
  crossRefFont: { color: { argb: 'FF000000' }, size: 11, name: 'Calibri' },
  sectionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } },
  sectionFont: { bold: true, color: { argb: 'FF1F4E79' }, size: 11, name: 'Calibri' },
  normalFont: { size: 11, name: 'Calibri' },
  borderThin: {
    top: { style: 'thin', color: { argb: 'FFB4C6E7' } },
    left: { style: 'thin', color: { argb: 'FFB4C6E7' } },
    bottom: { style: 'thin', color: { argb: 'FFB4C6E7' } },
    right: { style: 'thin', color: { argb: 'FFB4C6E7' } },
  },
  numberFormat: '#,##0',
  currencyFormat: '\u20B9#,##0',
  percentFormat: '0.0%',
};

function applyHeader(cell) {
  cell.fill = STYLES.headerFill;
  cell.font = STYLES.headerFont;
  cell.border = STYLES.borderThin;
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

function applyInput(cell) {
  cell.fill = STYLES.inputFill;
  cell.font = STYLES.inputFont;
  cell.border = STYLES.borderThin;
}

function applyFormula(cell) {
  cell.fill = STYLES.formulaFill;
  cell.font = STYLES.formulaFont;
  cell.border = STYLES.borderThin;
}

function applyCrossRef(cell) {
  cell.fill = STYLES.crossRefFill;
  cell.font = STYLES.crossRefFont;
  cell.border = STYLES.borderThin;
}

function applySection(cell) {
  cell.fill = STYLES.sectionFill;
  cell.font = STYLES.sectionFont;
  cell.border = STYLES.borderThin;
}

function applyNormal(cell) {
  cell.font = STYLES.normalFont;
  cell.border = STYLES.borderThin;
}

/**
 * Compute row metadata for all sheets so cross-sheet formula references
 * point to the correct rows. Centralizes the row-offset logic to avoid
 * off-by-one bugs across multiple sheet builders.
 */
function computeRowMeta(draft) {
  const employees = draft.employees || [];
  const channels = draft.marketingChannels || [];
  const adminExps = draft.adminExpenses || [];
  const capexItems = draft.capexItems || [];
  const loans = draft.loans || [];
  const products = draft.products || [];

  // ── HR Sheet (Sheet 1) ──
  // Header row = 4. Data starts at row 5.
  // For each non-empty category: 1 section-header row + N employee rows.
  // After data: 1 blank row, then the total row.
  const hrCategories = ['management', 'white_collar', 'blue_collar'];
  let hrDataRows = 0;
  const employeeRowMap = []; // maps flat employee index → actual Excel row in HR sheet
  let hrCursor = 5; // first data row after header at row 4
  for (const cat of hrCategories) {
    const catEmps = employees.filter(e => e.category === cat);
    if (catEmps.length === 0) continue;
    hrCursor++; // category section header row
    hrDataRows += 1;
    for (const emp of catEmps) {
      employeeRowMap.push(hrCursor);
      hrCursor++;
      hrDataRows++;
    }
  }
  // After data loop: hrCursor = first unused row.
  // buildHRSheet does: row++ (blank), then totRow = row.
  const hrTotRow = hrCursor + 1; // skip blank row

  // ── Marketing Sheet (Sheet 2) ──
  // Header row = 5. Channels at 6+. Totals after channels + blank.
  const mktTotRow = 5 + channels.length + 1;

  // ── Admin Sheet (Sheet 3D) ──
  // Data starts at row 4. For each non-empty category: 1 header + N items.
  // After data: 1 blank row (row++), then total row.
  const adminCats = ['Rent', 'Utilities', 'Repairs & Maintenance', 'Insurance', 'Office & Admin'];
  let adminDataRows = 0;
  for (const cat of adminCats) {
    const catExps = adminExps.filter(e => e.category === cat);
    if (catExps.length > 0) adminDataRows += 1 + catExps.length;
  }
  const adminTotRow = 4 + adminDataRows + 1; // +1 for blank row before totals

  // ── CAPEX Sheet (Sheet 3E) ──
  // Items at rows 4+. Totals after items + blank.
  const capexTotRow = 4 + capexItems.length + 1;

  // ── Finance Sheet (Sheet 3F) ──
  // Header row = 5. Loans at 6+. Totals after loans + blank.
  const financeTotRow = 5 + loans.length + 1;

  // ── Product Mix (Sheet 4) ──
  // Products at rows 4+. TOTAL row after products + blank.
  const pmTotRow = 4 + products.length + 1;

  // ── Cash Flow row constants (Sheet 7) ──
  const cfRows = {
    REVENUE_SEC: 4, PRODUCT_SALES: 5, OTHER_INCOME: 6, TOTAL_REV: 7,
    SPACER1: 8, EXPENSE_SEC: 9, COGS: 10, HR: 11, MARKETING: 12,
    ADMIN: 13, DEPRECIATION: 14, LOAN_EMI: 15, TOTAL_EXP: 16,
    SPACER2: 17, NET_CF: 18, CUM_CF: 19,
  };

  return {
    hrTotRow,
    mktTotRow,
    adminTotRow,
    capexTotRow,
    financeTotRow,
    pmTotRow,
    employeeRowMap,
    cfRows,
  };
}

/**
 * Generate a complete 17-sheet Unit Economics workbook from a draft object.
 * @param {Object} draft - The UnitEconomicsDraftSchema object
 * @returns {ExcelJS.Workbook}
 */
export async function generateWorkbook(draft) {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties = { fullCalcOnLoad: true };
  wb.creator = 'OnEasy Unit Economics Engine';
  wb.created = new Date();

  // Compute shared row metadata for cross-sheet references
  const meta = computeRowMeta(draft);

  // ── Sheet 0: Instructions & Guide ──
  buildInstructionsSheet(wb, draft);

  // ── Sheet 1: HR Costs ──
  buildHRSheet(wb, draft);

  // ── Sheet 1.1: Rate Card ──
  buildRateCardSheet(wb, draft, meta);

  // ── Sheet 2: Marketing Costs ──
  buildMarketingSheet(wb, draft);

  // ── Sheet 3: Manufacturing Costs ──
  buildManufacturingSheet(wb, draft);

  // ── Sheet 3A: Geo Purchase Costs ──
  buildGeoPurchaseSheet(wb, draft);

  // ── Sheet 3B: Geo Sale Prices ──
  buildGeoSalePricesSheet(wb, draft);

  // ── Sheet 3C: Geo Selector ──
  buildGeoSelectorSheet(wb, draft);

  // ── Sheet 3D: Admin & Other Expenses ──
  buildAdminSheet(wb, draft);

  // ── Sheet 3E: CAPEX ──
  buildCapexSheet(wb, draft);

  // ── Sheet 3F: Finance Costs ──
  buildFinanceSheet(wb, draft);

  // ── Sheet 4: Product Market Mix ──
  buildProductMixSheet(wb, draft, meta);

  // ── Sheet 5: Customer LTV Analysis ──
  buildLTVSheet(wb, draft);

  // ── Sheet 6: Target Profit Calculator ──
  buildTargetProfitSheet(wb, draft, meta);

  // ── Sheet 7: Cash Flow ──
  buildCashFlowSheet(wb, draft, meta);

  // ── Sheet 8: KPI Dashboard ──
  buildKPIDashboardSheet(wb, draft, meta);

  // ── Sheet 9: Scenario Analysis ──
  buildScenarioSheet(wb, draft, meta);

  return wb;
}

/* ════════════════════════════════════════════════════════════════════════════
   SHEET BUILDERS
   ════════════════════════════════════════════════════════════════════════════ */

function buildInstructionsSheet(wb, draft) {
  const ws = wb.addWorksheet('Instructions & Guide', { properties: { tabColor: { argb: 'FF1F4E79' } } });
  ws.columns = [{ width: 5 }, { width: 25 }, { width: 60 }];

  const title = ws.getCell('B2');
  title.value = `${draft.companyName || 'Company'} \u2014 Unit Economics Model`;
  title.font = { bold: true, size: 16, color: { argb: 'FF1F4E79' } };

  const subtitle = ws.getCell('B3');
  subtitle.value = `Generated by OnEasy AI on ${new Date().toLocaleDateString('en-IN')}`;
  subtitle.font = { size: 11, color: { argb: 'FF666666' } };

  // Color legend
  const legendStart = 5;
  const legend = [
    ['Color', 'Meaning'],
    ['', 'Header / Section Title'],
    ['', 'Input Cell (editable)'],
    ['', 'Formula Cell (auto-calculated)'],
    ['', 'Cross-Sheet Reference'],
  ];
  legend.forEach((row, i) => {
    const r = legendStart + i;
    const b = ws.getCell(`B${r}`);
    const c = ws.getCell(`C${r}`);
    b.value = row[0] || '';
    c.value = row[1];
    if (i === 0) {
      applyHeader(b); applyHeader(c);
    } else if (i === 1) { applyHeader(b); applyNormal(c); }
    else if (i === 2) { applyInput(b); applyNormal(c); }
    else if (i === 3) { applyFormula(b); applyNormal(c); }
    else if (i === 4) { applyCrossRef(b); applyNormal(c); }
  });

  // Sheet guide
  const guideStart = legendStart + legend.length + 1;
  const sheets = [
    ['Sheet', 'Description'],
    ['1. HR Costs', 'Team structure, salaries, CTC breakdown'],
    ['1.1 Rate Card', 'Hourly/daily rates auto-linked from HR'],
    ['2. Marketing Costs', 'Channels, funnel, CAC (AI-generated)'],
    ['3. Manufacturing Costs', 'Product BOM / cost build-up'],
    ['3A. Geo Purchase Costs', 'City-wise purchase/procurement costs'],
    ['3B. Geo Sale Prices', 'City-wise selling prices (margin-first)'],
    ['3C. Geo Selector', 'Dropdown city selection + monthly P&L'],
    ['3D. Admin Expenses', 'Rent, utilities, insurance, office costs'],
    ['3E. CAPEX', 'Fixed assets + depreciation schedule'],
    ['3F. Finance Costs', 'Loans, EMI, interest calculation'],
    ['4. Product Market Mix', 'YES/NO toggles, full cost build-up, break-even'],
    ['5. Customer LTV', 'Simple LTV, DCF LTV, cohort decay'],
    ['6. Target Profit', 'Reverse-engineer sales targets'],
    ['7. Cash Flow', '12-month projection + working capital'],
    ['8. KPI Dashboard', 'Financial, operational, marketing KPIs'],
    ['9. Scenario Analysis', 'Best/Base/Worst case comparison'],
  ];
  sheets.forEach((row, i) => {
    const r = guideStart + i;
    const b = ws.getCell(`B${r}`);
    const c = ws.getCell(`C${r}`);
    b.value = row[0];
    c.value = row[1];
    if (i === 0) { applyHeader(b); applyHeader(c); }
    else { applyNormal(b); applyNormal(c); b.font = { ...STYLES.normalFont, bold: true }; }
  });
}

function buildHRSheet(wb, draft) {
  const ws = wb.addWorksheet('1. HR Costs', { properties: { tabColor: { argb: 'FF2E75B6' } } });
  ws.columns = [
    { width: 5 },  // A: #
    { width: 25 }, // B: Role
    { width: 20 }, // C: Department
    { width: 15 }, // D: Category
    { width: 12 }, // E: Count
    { width: 15 }, // F: Monthly Salary
    { width: 15 }, // G: Annual CTC
    { width: 15 }, // H: Monthly Total
    { width: 15 }, // I: Annual Total
  ];

  // Title
  const titleCell = ws.getCell('B1');
  titleCell.value = 'HR Costs \u2014 Team Structure';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  // Assumptions row
  ws.getCell('B2').value = 'Working Days/Month:';
  const wdCell = ws.getCell('C2');
  wdCell.value = draft.assumptions?.workingDaysPerMonth || 26;
  applyInput(wdCell);

  ws.getCell('D2').value = 'Hours/Day:';
  const hdCell = ws.getCell('E2');
  hdCell.value = draft.assumptions?.hoursPerDay || 8;
  applyInput(hdCell);

  ws.getCell('F2').value = 'Efficiency:';
  const effCell = ws.getCell('G2');
  effCell.value = (draft.assumptions?.employeeEfficiency || 0.8);
  effCell.numFmt = STYLES.percentFormat;
  applyInput(effCell);

  // Headers
  const headers = ['#', 'Role / Position', 'Department', 'Category', 'Count', 'Monthly Salary (\u20B9)', 'Annual CTC (\u20B9)', 'Monthly Total (\u20B9)', 'Annual Total (\u20B9)'];
  const headerRow = 4;
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  // Employee rows by category
  const categories = ['management', 'white_collar', 'blue_collar'];
  const categoryLabels = { management: 'MANAGEMENT', white_collar: 'WHITE COLLAR', blue_collar: 'BLUE COLLAR' };
  let row = headerRow + 1;
  const employees = draft.employees || [];

  for (const cat of categories) {
    const catEmployees = employees.filter(e => e.category === cat);
    if (catEmployees.length === 0) continue;

    // Category section header
    const secCell = ws.getCell(`B${row}`);
    secCell.value = categoryLabels[cat];
    for (let c = 1; c <= 9; c++) applySection(ws.getCell(row, c));
    row++;

    catEmployees.forEach((emp, idx) => {
      const r = row;
      ws.getCell(`A${r}`).value = idx + 1;
      applyNormal(ws.getCell(`A${r}`));

      ws.getCell(`B${r}`).value = emp.name;
      applyNormal(ws.getCell(`B${r}`));

      ws.getCell(`C${r}`).value = emp.department;
      applyNormal(ws.getCell(`C${r}`));

      ws.getCell(`D${r}`).value = emp.category;
      applyNormal(ws.getCell(`D${r}`));

      const countCell = ws.getCell(`E${r}`);
      countCell.value = emp.count || 1;
      applyInput(countCell);

      const salaryCell = ws.getCell(`F${r}`);
      salaryCell.value = emp.monthlySalary;
      salaryCell.numFmt = STYLES.currencyFormat;
      applyInput(salaryCell);

      // Annual CTC = Monthly * 12
      const ctcCell = ws.getCell(`G${r}`);
      ctcCell.value = { formula: `F${r}*12` };
      ctcCell.numFmt = STYLES.currencyFormat;
      applyFormula(ctcCell);

      // Monthly Total = Count * Salary
      const mtCell = ws.getCell(`H${r}`);
      mtCell.value = { formula: `E${r}*F${r}` };
      mtCell.numFmt = STYLES.currencyFormat;
      applyFormula(mtCell);

      // Annual Total = Monthly Total * 12
      const atCell = ws.getCell(`I${r}`);
      atCell.value = { formula: `H${r}*12` };
      atCell.numFmt = STYLES.currencyFormat;
      applyFormula(atCell);

      row++;
    });
  }

  // Totals row
  row++;
  const totRow = row;
  ws.getCell(`B${totRow}`).value = 'TOTAL HR COSTS';
  applySection(ws.getCell(`B${totRow}`));
  for (let c = 1; c <= 9; c++) applySection(ws.getCell(totRow, c));

  // Sum formulas for Count, Monthly Total, Annual Total
  ws.getCell(`E${totRow}`).value = { formula: `SUM(E${headerRow + 1}:E${totRow - 1})` };
  ws.getCell(`E${totRow}`).numFmt = STYLES.numberFormat;
  applyFormula(ws.getCell(`E${totRow}`));

  ws.getCell(`H${totRow}`).value = { formula: `SUM(H${headerRow + 1}:H${totRow - 1})` };
  ws.getCell(`H${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`H${totRow}`));

  ws.getCell(`I${totRow}`).value = { formula: `SUM(I${headerRow + 1}:I${totRow - 1})` };
  ws.getCell(`I${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`I${totRow}`));
}

function buildRateCardSheet(wb, draft, meta) {
  const ws = wb.addWorksheet('1.1 Rate Card', { properties: { tabColor: { argb: 'FF2E75B6' } } });
  ws.columns = [
    { width: 5 }, { width: 25 }, { width: 15 }, { width: 15 },
    { width: 15 }, { width: 15 }, { width: 15 },
  ];

  ws.getCell('B1').value = 'Rate Card \u2014 Derived from HR Costs';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  ws.getCell('B2').value = 'Formula: Cost/Hour = Monthly Salary / (Working Days \u00D7 Hours/Day \u00D7 Efficiency%)';
  ws.getCell('B2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  const headers = ['#', 'Role', 'Monthly Salary', 'Cost/Hour', 'Cost/Day', 'Cost/Week', 'Cost/Month'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  const employees = draft.employees || [];
  employees.forEach((emp, idx) => {
    const r = 5 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    applyNormal(ws.getCell(`A${r}`));

    ws.getCell(`B${r}`).value = emp.name;
    applyNormal(ws.getCell(`B${r}`));

    // Cross-ref to HR sheet salary (use actual row from metadata)
    const salCell = ws.getCell(`C${r}`);
    const hrRow = meta.employeeRowMap[idx] || (5 + idx);
    salCell.value = { formula: `'1. HR Costs'!F${hrRow}` };
    salCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(salCell);

    // Cost/Hour = Salary / (WorkDays * Hours * Efficiency)
    const hourCell = ws.getCell(`D${r}`);
    hourCell.value = { formula: `C${r}/('1. HR Costs'!C2*'1. HR Costs'!E2*'1. HR Costs'!G2)` };
    hourCell.numFmt = STYLES.currencyFormat;
    applyFormula(hourCell);

    // Cost/Day = Cost/Hour * Hours/Day
    const dayCell = ws.getCell(`E${r}`);
    dayCell.value = { formula: `D${r}*'1. HR Costs'!E2` };
    dayCell.numFmt = STYLES.currencyFormat;
    applyFormula(dayCell);

    // Cost/Week = Cost/Day * 6
    const weekCell = ws.getCell(`F${r}`);
    weekCell.value = { formula: `E${r}*6` };
    weekCell.numFmt = STYLES.currencyFormat;
    applyFormula(weekCell);

    // Cost/Month = Salary
    const monthCell = ws.getCell(`G${r}`);
    monthCell.value = { formula: `C${r}` };
    monthCell.numFmt = STYLES.currencyFormat;
    applyFormula(monthCell);
  });
}

function buildMarketingSheet(wb, draft) {
  const ws = wb.addWorksheet('2. Marketing Costs', { properties: { tabColor: { argb: 'FF548235' } } });
  ws.columns = [
    { width: 5 }, { width: 25 }, { width: 15 }, { width: 15 },
    { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 },
  ];

  ws.getCell('B1').value = 'Marketing Costs \u2014 AI Generated';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  ws.getCell('B2').value = `Business Stage: ${draft.businessStage || 'N/A'} | Industry: ${draft.industry || 'N/A'}`;
  ws.getCell('B2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  const headers = ['#', 'Channel', 'Monthly Budget (\u20B9)', 'Expected Leads', 'Conv. Rate', 'Customers', 'CAC (\u20B9)', 'Annual Cost (\u20B9)'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  const channels = draft.marketingChannels || [];
  channels.forEach((ch, idx) => {
    const r = 5 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    applyNormal(ws.getCell(`A${r}`));

    ws.getCell(`B${r}`).value = ch.channel;
    applyNormal(ws.getCell(`B${r}`));

    const budgetCell = ws.getCell(`C${r}`);
    budgetCell.value = ch.monthlyBudget;
    budgetCell.numFmt = STYLES.currencyFormat;
    applyInput(budgetCell);

    const leadsCell = ws.getCell(`D${r}`);
    leadsCell.value = ch.expectedLeads;
    applyInput(leadsCell);

    const convCell = ws.getCell(`E${r}`);
    convCell.value = ch.conversionRate;
    convCell.numFmt = STYLES.percentFormat;
    applyInput(convCell);

    // Customers = Leads * Conversion Rate
    const custCell = ws.getCell(`F${r}`);
    custCell.value = { formula: `D${r}*E${r}` };
    custCell.numFmt = STYLES.numberFormat;
    applyFormula(custCell);

    // CAC = Budget / Customers (with IFERROR)
    const cacCell = ws.getCell(`G${r}`);
    cacCell.value = { formula: `IFERROR(C${r}/F${r},0)` };
    cacCell.numFmt = STYLES.currencyFormat;
    applyFormula(cacCell);

    // Annual Cost = Monthly * 12
    const annualCell = ws.getCell(`H${r}`);
    annualCell.value = { formula: `C${r}*12` };
    annualCell.numFmt = STYLES.currencyFormat;
    applyFormula(annualCell);
  });

  // Totals
  const totRow = 5 + channels.length + 1;
  ws.getCell(`B${totRow}`).value = 'TOTAL MARKETING';
  applySection(ws.getCell(`B${totRow}`));
  for (let c = 1; c <= 8; c++) applySection(ws.getCell(totRow, c));

  ws.getCell(`C${totRow}`).value = { formula: `SUM(C5:C${totRow - 1})` };
  ws.getCell(`C${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`C${totRow}`));

  ws.getCell(`D${totRow}`).value = { formula: `SUM(D5:D${totRow - 1})` };
  applyFormula(ws.getCell(`D${totRow}`));

  ws.getCell(`F${totRow}`).value = { formula: `SUM(F5:F${totRow - 1})` };
  applyFormula(ws.getCell(`F${totRow}`));

  // Blended CAC
  ws.getCell(`G${totRow}`).value = { formula: `IFERROR(C${totRow}/F${totRow},0)` };
  ws.getCell(`G${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`G${totRow}`));

  ws.getCell(`H${totRow}`).value = { formula: `SUM(H5:H${totRow - 1})` };
  ws.getCell(`H${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`H${totRow}`));
}

function buildManufacturingSheet(wb, draft) {
  const ws = wb.addWorksheet('3. Manufacturing Costs', { properties: { tabColor: { argb: 'FFBF8F00' } } });

  // Dynamic columns based on max cost elements
  const products = draft.products || [];
  const maxElements = Math.max(5, ...products.map(p => (p.costElements || []).length));

  const cols = [{ width: 5 }, { width: 25 }, { width: 15 }]; // #, Product, Group
  for (let i = 0; i < maxElements; i++) cols.push({ width: 14 }); // Cost elements
  cols.push({ width: 15 }); // Total Cost
  cols.push({ width: 12 }); // Target Margin
  cols.push({ width: 15 }); // Sale Price
  cols.push({ width: 12 }); // Monthly Vol
  cols.push({ width: 15 }); // Monthly Revenue
  ws.columns = cols;

  ws.getCell('B1').value = 'Manufacturing / COGS Costs \u2014 Product Cost Build-Up';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  ws.getCell('B2').value = 'Sale Price = Total Cost / (1 - Target Margin%)';
  ws.getCell('B2').font = { italic: true, size: 10, color: { argb: 'FFE53935' } };

  // Collect all unique cost element names
  const allElementNames = new Set();
  products.forEach(p => (p.costElements || []).forEach(e => allElementNames.add(e.name)));
  const elementNames = Array.from(allElementNames).slice(0, maxElements);
  while (elementNames.length < maxElements) elementNames.push(`Cost Element ${elementNames.length + 1}`);

  // Headers
  const headerLabels = ['#', 'Product Name', 'Group', ...elementNames, 'Total Cost (\u20B9)', 'Target Margin', 'Sale Price (\u20B9)', 'Monthly Vol', 'Monthly Revenue (\u20B9)'];
  headerLabels.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  products.forEach((prod, idx) => {
    const r = 5 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    applyNormal(ws.getCell(`A${r}`));

    ws.getCell(`B${r}`).value = prod.name;
    applyNormal(ws.getCell(`B${r}`));

    ws.getCell(`C${r}`).value = prod.group;
    applyNormal(ws.getCell(`C${r}`));

    // Cost elements
    const costCols = [];
    elementNames.forEach((eName, eIdx) => {
      const colIdx = 4 + eIdx; // 1-indexed column
      const cell = ws.getCell(r, colIdx);
      const element = (prod.costElements || []).find(e => e.name === eName);
      cell.value = element ? element.cost : 0;
      cell.numFmt = STYLES.currencyFormat;
      applyInput(cell);
      costCols.push(cell.address.replace(/\d+/, ''));
    });

    // Total Cost = SUM of cost element columns
    const totalCostCol = 4 + maxElements;
    const firstCostCol = String.fromCharCode(67 + 1); // D
    const lastCostCol = String.fromCharCode(67 + maxElements);
    const tcCell = ws.getCell(r, totalCostCol);
    tcCell.value = { formula: `SUM(${firstCostCol}${r}:${lastCostCol}${r})` };
    tcCell.numFmt = STYLES.currencyFormat;
    applyFormula(tcCell);

    // Target Margin
    const marginCol = totalCostCol + 1;
    const mCell = ws.getCell(r, marginCol);
    mCell.value = prod.targetMargin || 0.35;
    mCell.numFmt = STYLES.percentFormat;
    applyInput(mCell);

    // Sale Price = Total Cost / (1 - Margin)
    const priceCol = marginCol + 1;
    const tcAddr = tcCell.address.replace(/\d+/, '');
    const mAddr = mCell.address.replace(/\d+/, '');
    const pCell = ws.getCell(r, priceCol);
    pCell.value = { formula: `IFERROR(${tcAddr}${r}/(1-${mAddr}${r}),0)` };
    pCell.numFmt = STYLES.currencyFormat;
    applyFormula(pCell);

    // Monthly Volume
    const volCol = priceCol + 1;
    const vCell = ws.getCell(r, volCol);
    vCell.value = prod.monthlyVolume || 0;
    applyInput(vCell);

    // Monthly Revenue = Sale Price * Volume
    const revCol = volCol + 1;
    const pAddr = pCell.address.replace(/\d+/, '');
    const vAddr = vCell.address.replace(/\d+/, '');
    const rCell = ws.getCell(r, revCol);
    rCell.value = { formula: `${pAddr}${r}*${vAddr}${r}` };
    rCell.numFmt = STYLES.currencyFormat;
    applyFormula(rCell);
  });

  // Totals row
  const totRow = 5 + products.length + 1;
  ws.getCell(`B${totRow}`).value = 'TOTAL';
  for (let c = 1; c <= headerLabels.length; c++) applySection(ws.getCell(totRow, c));

  const revCol = 4 + maxElements + 4;
  const revColLetter = ws.getCell(5, revCol).address.replace(/\d+/, '');
  ws.getCell(totRow, revCol).value = { formula: `SUM(${revColLetter}5:${revColLetter}${totRow - 1})` };
  ws.getCell(totRow, revCol).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(totRow, revCol));
}

function buildGeoPurchaseSheet(wb, draft) {
  const ws = wb.addWorksheet('3A. Geo Purchase Costs', { properties: { tabColor: { argb: 'FFBF8F00' } } });
  const products = draft.products || [];
  const cities = draft.cities || [];

  const cols = [{ width: 5 }, { width: 25 }];
  cities.forEach(() => cols.push({ width: 15 }));
  ws.columns = cols;

  ws.getCell('B1').value = 'Geo Purchase Costs \u2014 City-wise Procurement';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  const headers = ['#', 'Product'];
  cities.forEach(c => headers.push(c.cityName));
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  products.forEach((prod, pIdx) => {
    const r = 4 + pIdx;
    ws.getCell(`A${r}`).value = pIdx + 1;
    applyNormal(ws.getCell(`A${r}`));
    ws.getCell(`B${r}`).value = prod.name;
    applyNormal(ws.getCell(`B${r}`));

    cities.forEach((city, cIdx) => {
      const cell = ws.getCell(r, 3 + cIdx);
      const cityProd = (city.products || []).find(p => p.productName === prod.name);
      cell.value = cityProd ? cityProd.purchaseCost : 0;
      cell.numFmt = STYLES.currencyFormat;
      applyInput(cell);
    });
  });
}

function buildGeoSalePricesSheet(wb, draft) {
  const ws = wb.addWorksheet('3B. Geo Sale Prices', { properties: { tabColor: { argb: 'FFBF8F00' } } });
  const products = draft.products || [];
  const cities = draft.cities || [];

  const cols = [{ width: 5 }, { width: 25 }];
  cities.forEach(() => cols.push({ width: 15 }));
  ws.columns = cols;

  ws.getCell('B1').value = 'Geo Sale Prices \u2014 City-wise Selling Prices';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  const headers = ['#', 'Product'];
  cities.forEach(c => headers.push(c.cityName));
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  products.forEach((prod, pIdx) => {
    const r = 4 + pIdx;
    ws.getCell(`A${r}`).value = pIdx + 1;
    applyNormal(ws.getCell(`A${r}`));
    ws.getCell(`B${r}`).value = prod.name;
    applyNormal(ws.getCell(`B${r}`));

    cities.forEach((city, cIdx) => {
      const cell = ws.getCell(r, 3 + cIdx);
      const cityProd = (city.products || []).find(p => p.productName === prod.name);
      cell.value = cityProd ? cityProd.salePrice : 0;
      cell.numFmt = STYLES.currencyFormat;
      applyInput(cell);
    });
  });
}

function buildGeoSelectorSheet(wb, draft) {
  const ws = wb.addWorksheet('3C. Geo Selector', { properties: { tabColor: { argb: 'FFBF8F00' } } });
  ws.columns = [
    { width: 5 }, { width: 25 }, { width: 15 }, { width: 15 },
    { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 },
  ];

  ws.getCell('B1').value = 'Geo Selector \u2014 Monthly P&L per Product';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  ws.getCell('B2').value = 'Change the city below to update purchase costs and sale prices automatically.';
  ws.getCell('B2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  ws.getCell('B3').value = 'Selected City:';
  ws.getCell('B3').font = { bold: true };
  const cityCell = ws.getCell('C3');
  const cities = draft.cities || [];
  const cityNames = cities.map(c => c.cityName);
  const defaultCity = cityNames[0] || 'N/A';
  cityCell.value = defaultCity;
  applyInput(cityCell);

  // Add data validation dropdown for city selection if cities exist
  if (cityNames.length > 1) {
    cityCell.dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${cityNames.join(',')}"`],
      showDropDown: true,
    };
  }

  const headers = ['#', 'Product', 'Purchase Cost', 'Sale Price', 'Margin %', 'Monthly Vol', 'Monthly Revenue', 'Monthly Profit'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(5, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  const products = draft.products || [];

  // Determine the column range in sheets 3A and 3B for city headers
  // 3A and 3B: row 3 = headers, columns C onwards = cities
  // Products: row 4 onwards
  const firstCityCol = 'C'; // Cities start at column C in 3A/3B
  const lastCityColIdx = 3 + Math.max(cities.length - 1, 0); // e.g. C=3, D=4, etc.
  const lastCityCol = String.fromCharCode(64 + lastCityColIdx); // Convert to letter

  products.forEach((prod, idx) => {
    const r = 6 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    applyNormal(ws.getCell(`A${r}`));

    ws.getCell(`B${r}`).value = prod.name;
    applyNormal(ws.getCell(`B${r}`));

    // Purchase cost: INDEX/MATCH to look up selected city from 3A
    const pcCell = ws.getCell(`C${r}`);
    if (cities.length > 1) {
      // INDEX(row in 3A, MATCH(selected city, city header row in 3A))
      pcCell.value = { formula: `IFERROR(INDEX('3A. Geo Purchase Costs'!${firstCityCol}${4 + idx}:${lastCityCol}${4 + idx},1,MATCH($C$3,'3A. Geo Purchase Costs'!${firstCityCol}$3:${lastCityCol}$3,0)),0)` };
    } else {
      // Single city: direct reference
      pcCell.value = { formula: `'3A. Geo Purchase Costs'!C${4 + idx}` };
    }
    pcCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(pcCell);

    // Sale price: INDEX/MATCH to look up selected city from 3B
    const spCell = ws.getCell(`D${r}`);
    if (cities.length > 1) {
      spCell.value = { formula: `IFERROR(INDEX('3B. Geo Sale Prices'!${firstCityCol}${4 + idx}:${lastCityCol}${4 + idx},1,MATCH($C$3,'3B. Geo Sale Prices'!${firstCityCol}$3:${lastCityCol}$3,0)),0)` };
    } else {
      spCell.value = { formula: `'3B. Geo Sale Prices'!C${4 + idx}` };
    }
    spCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(spCell);

    // Margin % = (SP - PC) / SP
    const mgCell = ws.getCell(`E${r}`);
    mgCell.value = { formula: `IFERROR((D${r}-C${r})/D${r},0)` };
    mgCell.numFmt = STYLES.percentFormat;
    applyFormula(mgCell);

    // Monthly Volume
    const volCell = ws.getCell(`F${r}`);
    volCell.value = prod.monthlyVolume || 0;
    applyInput(volCell);

    // Monthly Revenue = SP * Vol
    const revCell = ws.getCell(`G${r}`);
    revCell.value = { formula: `D${r}*F${r}` };
    revCell.numFmt = STYLES.currencyFormat;
    applyFormula(revCell);

    // Monthly Profit = (SP - PC) * Vol
    const profCell = ws.getCell(`H${r}`);
    profCell.value = { formula: `(D${r}-C${r})*F${r}` };
    profCell.numFmt = STYLES.currencyFormat;
    applyFormula(profCell);
  });

  // Totals row
  const totRow = 6 + products.length + 1;
  ws.getCell(`B${totRow}`).value = 'TOTAL';
  for (let c = 1; c <= 8; c++) applySection(ws.getCell(totRow, c));

  ws.getCell(`F${totRow}`).value = { formula: `SUM(F6:F${totRow - 1})` };
  ws.getCell(`F${totRow}`).numFmt = STYLES.numberFormat;
  applyFormula(ws.getCell(`F${totRow}`));

  ws.getCell(`G${totRow}`).value = { formula: `SUM(G6:G${totRow - 1})` };
  ws.getCell(`G${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`G${totRow}`));

  ws.getCell(`H${totRow}`).value = { formula: `SUM(H6:H${totRow - 1})` };
  ws.getCell(`H${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`H${totRow}`));

  // Weighted Average Margin
  ws.getCell(`E${totRow}`).value = { formula: `IFERROR(H${totRow}/G${totRow},0)` };
  ws.getCell(`E${totRow}`).numFmt = STYLES.percentFormat;
  applyFormula(ws.getCell(`E${totRow}`));
}

function buildAdminSheet(wb, draft) {
  const ws = wb.addWorksheet('3D. Admin & Other Expenses', { properties: { tabColor: { argb: 'FFC00000' } } });
  ws.columns = [{ width: 5 }, { width: 20 }, { width: 30 }, { width: 15 }, { width: 15 }];

  ws.getCell('B1').value = 'Admin & Other Expenses';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  const headers = ['#', 'Category', 'Expense Item', 'Monthly (\u20B9)', 'Annual (\u20B9)'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  const expenses = draft.adminExpenses || [];
  const categories = ['Rent', 'Utilities', 'Repairs & Maintenance', 'Insurance', 'Office & Admin'];
  let row = 4;

  for (const cat of categories) {
    const catExpenses = expenses.filter(e => e.category === cat);
    if (catExpenses.length === 0) continue;

    ws.getCell(`B${row}`).value = cat.toUpperCase();
    for (let c = 1; c <= 5; c++) applySection(ws.getCell(row, c));
    row++;

    catExpenses.forEach((exp, idx) => {
      ws.getCell(`A${row}`).value = idx + 1;
      applyNormal(ws.getCell(`A${row}`));

      ws.getCell(`B${row}`).value = exp.category;
      applyNormal(ws.getCell(`B${row}`));

      ws.getCell(`C${row}`).value = exp.item;
      applyNormal(ws.getCell(`C${row}`));

      const mCell = ws.getCell(`D${row}`);
      mCell.value = exp.monthlyAmount;
      mCell.numFmt = STYLES.currencyFormat;
      applyInput(mCell);

      const aCell = ws.getCell(`E${row}`);
      aCell.value = { formula: `D${row}*12` };
      aCell.numFmt = STYLES.currencyFormat;
      applyFormula(aCell);

      row++;
    });
  }

  // Totals
  row++;
  ws.getCell(`C${row}`).value = 'TOTAL ADMIN EXPENSES';
  applySection(ws.getCell(`C${row}`));
  for (let c = 1; c <= 5; c++) applySection(ws.getCell(row, c));

  ws.getCell(`D${row}`).value = { formula: `SUM(D4:D${row - 1})` };
  ws.getCell(`D${row}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`D${row}`));

  ws.getCell(`E${row}`).value = { formula: `SUM(E4:E${row - 1})` };
  ws.getCell(`E${row}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`E${row}`));
}

function buildCapexSheet(wb, draft) {
  const ws = wb.addWorksheet('3E. Capital Expenses (CAPEX)', { properties: { tabColor: { argb: 'FF7030A0' } } });
  ws.columns = [
    { width: 5 }, { width: 20 }, { width: 25 }, { width: 15 },
    { width: 12 }, { width: 15 }, { width: 15 },
  ];

  ws.getCell('B1').value = 'Capital Expenses (CAPEX) \u2014 Fixed Assets & Depreciation';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  const headers = ['#', 'Category', 'Asset', 'Cost (\u20B9)', 'Useful Life (Yrs)', 'Annual Dep (\u20B9)', 'Monthly Dep (\u20B9)'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  const items = draft.capexItems || [];
  items.forEach((item, idx) => {
    const r = 4 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    applyNormal(ws.getCell(`A${r}`));

    ws.getCell(`B${r}`).value = item.category;
    applyNormal(ws.getCell(`B${r}`));

    ws.getCell(`C${r}`).value = item.item;
    applyNormal(ws.getCell(`C${r}`));

    const costCell = ws.getCell(`D${r}`);
    costCell.value = item.cost;
    costCell.numFmt = STYLES.currencyFormat;
    applyInput(costCell);

    const lifeCell = ws.getCell(`E${r}`);
    lifeCell.value = item.usefulLife;
    applyInput(lifeCell);

    // Annual Depreciation = Cost / Useful Life (SLM)
    const adCell = ws.getCell(`F${r}`);
    adCell.value = { formula: `IFERROR(D${r}/E${r},0)` };
    adCell.numFmt = STYLES.currencyFormat;
    applyFormula(adCell);

    // Monthly Depreciation
    const mdCell = ws.getCell(`G${r}`);
    mdCell.value = { formula: `F${r}/12` };
    mdCell.numFmt = STYLES.currencyFormat;
    applyFormula(mdCell);
  });

  // Totals
  const totRow = 4 + items.length + 1;
  ws.getCell(`C${totRow}`).value = 'TOTAL CAPEX';
  for (let c = 1; c <= 7; c++) applySection(ws.getCell(totRow, c));

  ws.getCell(`D${totRow}`).value = { formula: `SUM(D4:D${totRow - 1})` };
  ws.getCell(`D${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`D${totRow}`));

  ws.getCell(`F${totRow}`).value = { formula: `SUM(F4:F${totRow - 1})` };
  ws.getCell(`F${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`F${totRow}`));

  ws.getCell(`G${totRow}`).value = { formula: `SUM(G4:G${totRow - 1})` };
  ws.getCell(`G${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`G${totRow}`));
}

function buildFinanceSheet(wb, draft) {
  const ws = wb.addWorksheet('3F. Finance Costs', { properties: { tabColor: { argb: 'FF7030A0' } } });
  ws.columns = [
    { width: 5 }, { width: 25 }, { width: 15 }, { width: 12 },
    { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 },
  ];

  ws.getCell('B1').value = 'Finance Costs \u2014 Loans & EMI';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  ws.getCell('B2').value = 'EMI = PMT(rate/12, tenure, -principal)';
  ws.getCell('B2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  const headers = ['#', 'Loan Description', 'Principal (\u20B9)', 'Rate %', 'Tenure (Mo)', 'Monthly EMI (\u20B9)', 'Monthly Interest (\u20B9)', 'Total Interest (\u20B9)'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  const loans = draft.loans || [];
  loans.forEach((loan, idx) => {
    const r = 5 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    applyNormal(ws.getCell(`A${r}`));

    ws.getCell(`B${r}`).value = loan.name;
    applyNormal(ws.getCell(`B${r}`));

    const pCell = ws.getCell(`C${r}`);
    pCell.value = loan.principal;
    pCell.numFmt = STYLES.currencyFormat;
    applyInput(pCell);

    const rCell = ws.getCell(`D${r}`);
    rCell.value = loan.interestRate;
    rCell.numFmt = STYLES.percentFormat;
    applyInput(rCell);

    const tCell = ws.getCell(`E${r}`);
    tCell.value = loan.tenureMonths;
    applyInput(tCell);

    // EMI = PMT(rate/12, tenure, -principal)
    const emiCell = ws.getCell(`F${r}`);
    emiCell.value = { formula: `IFERROR(-PMT(D${r}/12,E${r},C${r}),0)` };
    emiCell.numFmt = STYLES.currencyFormat;
    applyFormula(emiCell);

    // Monthly Interest (approximate first month) = Principal * Rate / 12
    const intCell = ws.getCell(`G${r}`);
    intCell.value = { formula: `C${r}*D${r}/12` };
    intCell.numFmt = STYLES.currencyFormat;
    applyFormula(intCell);

    // Total Interest = (EMI * Tenure) - Principal
    const tiCell = ws.getCell(`H${r}`);
    tiCell.value = { formula: `(F${r}*E${r})-C${r}` };
    tiCell.numFmt = STYLES.currencyFormat;
    applyFormula(tiCell);
  });

  // Totals
  const totRow = 5 + loans.length + 1;
  ws.getCell(`B${totRow}`).value = 'TOTAL FINANCE COSTS';
  for (let c = 1; c <= 8; c++) applySection(ws.getCell(totRow, c));

  ws.getCell(`C${totRow}`).value = { formula: `SUM(C5:C${totRow - 1})` };
  ws.getCell(`C${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`C${totRow}`));

  ws.getCell(`F${totRow}`).value = { formula: `SUM(F5:F${totRow - 1})` };
  ws.getCell(`F${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`F${totRow}`));

  ws.getCell(`G${totRow}`).value = { formula: `SUM(G5:G${totRow - 1})` };
  ws.getCell(`G${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`G${totRow}`));
}

function buildProductMixSheet(wb, draft, meta) {
  const ws = wb.addWorksheet('4. Product Market Mix', { properties: { tabColor: { argb: 'FF00B050' } } });
  ws.columns = [
    { width: 5 }, { width: 25 }, { width: 10 }, { width: 15 },
    { width: 15 }, { width: 12 }, { width: 15 }, { width: 15 },
    { width: 15 }, { width: 15 },
  ];

  ws.getCell('B1').value = 'Product Market Mix \u2014 Cost Build-Up & Break-Even';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  const headers = ['#', 'Product', 'Active?', 'Total Cost/Unit', 'Sale Price', 'Margin %', 'Contribution/Unit', 'Monthly Vol', 'Monthly Contrib', 'Break-Even Units'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  const products = draft.products || [];
  products.forEach((prod, idx) => {
    const r = 4 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    applyNormal(ws.getCell(`A${r}`));

    ws.getCell(`B${r}`).value = prod.name;
    applyNormal(ws.getCell(`B${r}`));

    // YES/NO toggle
    const toggleCell = ws.getCell(`C${r}`);
    toggleCell.value = 'YES';
    applyInput(toggleCell);

    // Total Cost from Sheet 3
    const costCol = 4 + (draft.products?.[0]?.costElements?.length || 5); // Total Cost column in Sheet 3
    const tcCell = ws.getCell(`D${r}`);
    const totalCost = (prod.costElements || []).reduce((sum, e) => sum + (e.cost || 0), 0);
    tcCell.value = totalCost;
    tcCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(tcCell);

    // Sale Price = Cost / (1 - Margin)
    const spCell = ws.getCell(`E${r}`);
    const margin = prod.targetMargin || 0.35;
    spCell.value = totalCost > 0 ? totalCost / (1 - margin) : 0;
    spCell.numFmt = STYLES.currencyFormat;
    applyFormula(spCell);

    // Margin %
    const mgCell = ws.getCell(`F${r}`);
    mgCell.value = { formula: `IFERROR((E${r}-D${r})/E${r},0)` };
    mgCell.numFmt = STYLES.percentFormat;
    applyFormula(mgCell);

    // Contribution/Unit = SP - Cost (only if Active = YES)
    const cuCell = ws.getCell(`G${r}`);
    cuCell.value = { formula: `IF(C${r}="YES",E${r}-D${r},0)` };
    cuCell.numFmt = STYLES.currencyFormat;
    applyFormula(cuCell);

    // Monthly Volume
    const volCell = ws.getCell(`H${r}`);
    volCell.value = prod.monthlyVolume || 0;
    applyInput(volCell);

    // Monthly Contribution = Contrib/Unit * Vol
    const mcCell = ws.getCell(`I${r}`);
    mcCell.value = { formula: `G${r}*H${r}` };
    mcCell.numFmt = STYLES.currencyFormat;
    applyFormula(mcCell);

    // Break-Even = Fixed Costs / Contribution per Unit
    const beCell = ws.getCell(`J${r}`);
    beCell.value = { formula: `IFERROR(ROUND(('3D. Admin & Other Expenses'!D${meta.adminTotRow}+'1. HR Costs'!H${meta.hrTotRow})/G${r},0),0)` };
    applyFormula(beCell);
  });

  // Totals
  const totRow = 4 + products.length + 1;
  ws.getCell(`B${totRow}`).value = 'TOTAL';
  for (let c = 1; c <= 10; c++) applySection(ws.getCell(totRow, c));

  ws.getCell(`I${totRow}`).value = { formula: `SUM(I4:I${totRow - 1})` };
  ws.getCell(`I${totRow}`).numFmt = STYLES.currencyFormat;
  applyFormula(ws.getCell(`I${totRow}`));
}

function buildLTVSheet(wb, draft) {
  const ws = wb.addWorksheet('5. Customer LTV Analysis', { properties: { tabColor: { argb: 'FF0070C0' } } });

  // Wide enough for 24-month cohort table
  const cols = [{ width: 5 }, { width: 30 }, { width: 18 }, { width: 18 }];
  // Extra columns for cohort (months 0-24)
  for (let i = 0; i < 25; i++) cols.push({ width: 13 });
  ws.columns = cols;

  ws.getCell('B1').value = 'Customer Lifetime Value (LTV) Analysis';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  const ltv = draft.ltvParams || {};
  const mktTotRow = 5 + (draft.marketingChannels?.length || 0) + 1;

  // ═══ SECTION 1: Input Parameters (rows 3-8) ═══
  const params = [
    ['', 'Parameter', 'Value', 'Notes'],
    ['1', 'Average Order Value (AOV)', ltv.avgOrderValue || 0, 'Per transaction'],
    ['2', 'Purchase Frequency/Year', ltv.purchaseFrequency || 12, 'Times per year'],
    ['3', 'Customer Retention Rate', ltv.retentionRate || 0.7, 'Annual retention'],
    ['4', 'Gross Margin', ltv.grossMargin || 0.4, 'After COGS'],
    ['5', 'Discount Rate (WACC)', ltv.discountRate || 0.1, 'For DCF method'],
  ];

  params.forEach((row, i) => {
    const r = 3 + i;
    ws.getCell(`A${r}`).value = row[0];
    ws.getCell(`B${r}`).value = row[1];
    ws.getCell(`C${r}`).value = row[2];
    ws.getCell(`D${r}`).value = row[3];

    if (i === 0) {
      applyHeader(ws.getCell(`A${r}`));
      applyHeader(ws.getCell(`B${r}`));
      applyHeader(ws.getCell(`C${r}`));
      applyHeader(ws.getCell(`D${r}`));
    } else {
      applyNormal(ws.getCell(`A${r}`));
      applyNormal(ws.getCell(`B${r}`));
      applyInput(ws.getCell(`C${r}`));
      applyNormal(ws.getCell(`D${r}`));
      if (i === 3 || i === 4 || i === 5) ws.getCell(`C${r}`).numFmt = STYLES.percentFormat;
      else if (i === 2) ws.getCell(`C${r}`).numFmt = STYLES.numberFormat;
      else ws.getCell(`C${r}`).numFmt = STYLES.currencyFormat;
    }
  });

  // Cell refs: C4=AOV, C5=Freq, C6=Retention, C7=Margin, C8=Discount

  // ═══ SECTION 2: Simple LTV Calculations (rows 10-15) ═══
  const calcStart = 10;
  const calcHeaders = ['', 'Metric', 'Formula', 'Result'];
  calcHeaders.forEach((h, i) => {
    const cell = ws.getCell(calcStart, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  // Row 11: Annual Revenue/Customer
  ws.getCell(`A${calcStart + 1}`).value = '1'; applyNormal(ws.getCell(`A${calcStart + 1}`));
  ws.getCell(`B${calcStart + 1}`).value = 'Annual Revenue/Customer'; applyNormal(ws.getCell(`B${calcStart + 1}`));
  ws.getCell(`C${calcStart + 1}`).value = 'AOV \u00D7 Frequency'; applyNormal(ws.getCell(`C${calcStart + 1}`));
  const arvCell = ws.getCell(`D${calcStart + 1}`);
  arvCell.value = { formula: 'C4*C5' };
  arvCell.numFmt = STYLES.currencyFormat;
  applyFormula(arvCell);

  // Row 12: Customer Lifespan
  ws.getCell(`A${calcStart + 2}`).value = '2'; applyNormal(ws.getCell(`A${calcStart + 2}`));
  ws.getCell(`B${calcStart + 2}`).value = 'Customer Lifespan (years)'; applyNormal(ws.getCell(`B${calcStart + 2}`));
  ws.getCell(`C${calcStart + 2}`).value = '1 / (1 - Retention)'; applyNormal(ws.getCell(`C${calcStart + 2}`));
  const lsCell = ws.getCell(`D${calcStart + 2}`);
  lsCell.value = { formula: 'IFERROR(1/(1-C6),1)' };
  lsCell.numFmt = '#,##0.0';
  applyFormula(lsCell);

  // Row 13: Simple LTV
  ws.getCell(`A${calcStart + 3}`).value = '3'; applyNormal(ws.getCell(`A${calcStart + 3}`));
  ws.getCell(`B${calcStart + 3}`).value = 'Simple LTV'; applyNormal(ws.getCell(`B${calcStart + 3}`));
  ws.getCell(`C${calcStart + 3}`).value = 'Annual Rev \u00D7 Lifespan \u00D7 Margin'; applyNormal(ws.getCell(`C${calcStart + 3}`));
  const sltvCell = ws.getCell(`D${calcStart + 3}`);
  sltvCell.value = { formula: `D${calcStart + 1}*D${calcStart + 2}*C7` };
  sltvCell.numFmt = STYLES.currencyFormat;
  applyFormula(sltvCell);

  // Row 14: Blended CAC (cross-ref)
  ws.getCell(`A${calcStart + 4}`).value = '4'; applyNormal(ws.getCell(`A${calcStart + 4}`));
  ws.getCell(`B${calcStart + 4}`).value = 'Blended CAC'; applyNormal(ws.getCell(`B${calcStart + 4}`));
  ws.getCell(`C${calcStart + 4}`).value = 'From Marketing sheet'; applyNormal(ws.getCell(`C${calcStart + 4}`));
  const cacCell = ws.getCell(`D${calcStart + 4}`);
  cacCell.value = { formula: `'2. Marketing Costs'!G${mktTotRow}` };
  cacCell.numFmt = STYLES.currencyFormat;
  applyCrossRef(cacCell);

  // Row 15: LTV:CAC Ratio
  ws.getCell(`A${calcStart + 5}`).value = '5'; applyNormal(ws.getCell(`A${calcStart + 5}`));
  ws.getCell(`B${calcStart + 5}`).value = 'LTV:CAC Ratio'; applyNormal(ws.getCell(`B${calcStart + 5}`));
  ws.getCell(`C${calcStart + 5}`).value = 'Simple LTV / CAC'; applyNormal(ws.getCell(`C${calcStart + 5}`));
  const lcrCell = ws.getCell(`D${calcStart + 5}`);
  lcrCell.value = { formula: `IFERROR(D${calcStart + 3}/D${calcStart + 4},0)` };
  lcrCell.numFmt = '#,##0.0"x"';
  applyFormula(lcrCell);

  // ═══ SECTION 3: 24-Month Cohort Decay & DCF LTV Table (rows 17+) ═══
  const cohortStart = 17;
  ws.getCell(`B${cohortStart}`).value = '24-Month Cohort Decay & DCF LTV';
  ws.getCell(`B${cohortStart}`).font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };

  // Cohort table headers (row 18)
  const cohortHeaderRow = cohortStart + 1;
  ws.getCell(`A${cohortHeaderRow}`).value = '';
  ws.getCell(`B${cohortHeaderRow}`).value = 'Metric';
  applyHeader(ws.getCell(`A${cohortHeaderRow}`));
  applyHeader(ws.getCell(`B${cohortHeaderRow}`));

  // Month columns: C through AB (columns 3 to 27 = months 0 to 24)
  for (let m = 0; m <= 24; m++) {
    const cell = ws.getCell(cohortHeaderRow, 3 + m);
    cell.value = m === 0 ? 'Month 0' : `Month ${m}`;
    applyHeader(cell);
  }

  // Row 19: Surviving Customers (start with 1000, decay by monthly churn)
  const survRow = cohortHeaderRow + 1;
  ws.getCell(`B${survRow}`).value = 'Surviving Customers';
  applyNormal(ws.getCell(`A${survRow}`));
  applyNormal(ws.getCell(`B${survRow}`));
  ws.getCell(`B${survRow}`).font = { ...STYLES.normalFont, bold: true };

  for (let m = 0; m <= 24; m++) {
    const cell = ws.getCell(survRow, 3 + m);
    if (m === 0) {
      cell.value = 1000; // Starting cohort size
      applyInput(cell);
    } else {
      // Monthly retention = Annual retention ^ (1/12)
      // Surviving = Previous * (Retention ^ (1/12))
      const prevCol = ws.getCell(survRow, 2 + m).address.replace(/\d+/, '');
      cell.value = { formula: `ROUND(${prevCol}${survRow}*($C$6^(1/12)),0)` };
      applyFormula(cell);
    }
    cell.numFmt = STYLES.numberFormat;
  }

  // Row 20: Monthly Revenue per Customer (AOV * Freq/12)
  const mrevRow = survRow + 1;
  ws.getCell(`B${mrevRow}`).value = 'Monthly Rev/Customer';
  applyNormal(ws.getCell(`A${mrevRow}`));
  applyNormal(ws.getCell(`B${mrevRow}`));
  ws.getCell(`B${mrevRow}`).font = { ...STYLES.normalFont, bold: true };

  for (let m = 0; m <= 24; m++) {
    const cell = ws.getCell(mrevRow, 3 + m);
    cell.value = { formula: '$C$4*($C$5/12)' };
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  }

  // Row 21: Total Cohort Revenue = Surviving * Monthly Rev
  const trevRow = mrevRow + 1;
  ws.getCell(`B${trevRow}`).value = 'Total Cohort Revenue';
  applyNormal(ws.getCell(`A${trevRow}`));
  applyNormal(ws.getCell(`B${trevRow}`));
  ws.getCell(`B${trevRow}`).font = { ...STYLES.normalFont, bold: true };

  for (let m = 0; m <= 24; m++) {
    const col = ws.getCell(trevRow, 3 + m).address.replace(/\d+/, '');
    const cell = ws.getCell(trevRow, 3 + m);
    cell.value = { formula: `${col}${survRow}*${col}${mrevRow}` };
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  }

  // Row 22: Gross Profit = Total Revenue * Margin
  const gpRow = trevRow + 1;
  ws.getCell(`B${gpRow}`).value = 'Gross Profit';
  applyNormal(ws.getCell(`A${gpRow}`));
  applyNormal(ws.getCell(`B${gpRow}`));
  ws.getCell(`B${gpRow}`).font = { ...STYLES.normalFont, bold: true };

  for (let m = 0; m <= 24; m++) {
    const col = ws.getCell(gpRow, 3 + m).address.replace(/\d+/, '');
    const cell = ws.getCell(gpRow, 3 + m);
    cell.value = { formula: `${col}${trevRow}*$C$7` };
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  }

  // Row 23: Discount Factor = 1 / (1 + rate/12)^month
  const dfRow = gpRow + 1;
  ws.getCell(`B${dfRow}`).value = 'Discount Factor';
  applyNormal(ws.getCell(`A${dfRow}`));
  applyNormal(ws.getCell(`B${dfRow}`));
  ws.getCell(`B${dfRow}`).font = { ...STYLES.normalFont, bold: true };

  for (let m = 0; m <= 24; m++) {
    const cell = ws.getCell(dfRow, 3 + m);
    cell.value = { formula: `1/(1+$C$8/12)^${m}` };
    cell.numFmt = '0.0000';
    applyFormula(cell);
  }

  // Row 24: DCF Gross Profit = Gross Profit * Discount Factor
  const dcfRow = dfRow + 1;
  ws.getCell(`B${dcfRow}`).value = 'DCF Gross Profit';
  applyNormal(ws.getCell(`A${dcfRow}`));
  applyNormal(ws.getCell(`B${dcfRow}`));
  ws.getCell(`B${dcfRow}`).font = { ...STYLES.normalFont, bold: true };

  for (let m = 0; m <= 24; m++) {
    const col = ws.getCell(dcfRow, 3 + m).address.replace(/\d+/, '');
    const cell = ws.getCell(dcfRow, 3 + m);
    cell.value = { formula: `${col}${gpRow}*${col}${dfRow}` };
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  }

  // Row 25: Cumulative DCF = running sum
  const cumRow = dcfRow + 1;
  ws.getCell(`B${cumRow}`).value = 'Cumulative DCF';
  applyNormal(ws.getCell(`A${cumRow}`));
  applyNormal(ws.getCell(`B${cumRow}`));
  ws.getCell(`B${cumRow}`).font = { ...STYLES.normalFont, bold: true };

  for (let m = 0; m <= 24; m++) {
    const col = ws.getCell(cumRow, 3 + m).address.replace(/\d+/, '');
    const cell = ws.getCell(cumRow, 3 + m);
    if (m === 0) {
      cell.value = { formula: `${col}${dcfRow}` };
    } else {
      const prevCol = ws.getCell(cumRow, 2 + m).address.replace(/\d+/, '');
      cell.value = { formula: `${prevCol}${cumRow}+${col}${dcfRow}` };
    }
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  }

  // ═══ SECTION 4: DCF LTV Summary (rows 27-30) ═══
  const sumStart = cumRow + 2;
  ws.getCell(`B${sumStart}`).value = 'DCF LTV Summary';
  ws.getCell(`B${sumStart}`).font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };

  // DCF LTV per customer (24-month)
  ws.getCell(`B${sumStart + 1}`).value = 'DCF LTV per Customer (24-mo):';
  ws.getCell(`B${sumStart + 1}`).font = { bold: true };
  applyNormal(ws.getCell(`B${sumStart + 1}`));
  const dcfLtvCell = ws.getCell(`C${sumStart + 1}`);
  // Last column of cumulative DCF / starting cohort
  const lastCumCol = ws.getCell(cumRow, 27).address.replace(/\d+/, ''); // column 27 = Month 24
  dcfLtvCell.value = { formula: `IFERROR(${lastCumCol}${cumRow}/C${survRow},0)` };
  dcfLtvCell.numFmt = STYLES.currencyFormat;
  applyFormula(dcfLtvCell);

  // DCF LTV:CAC
  ws.getCell(`B${sumStart + 2}`).value = 'DCF LTV:CAC Ratio:';
  ws.getCell(`B${sumStart + 2}`).font = { bold: true };
  applyNormal(ws.getCell(`B${sumStart + 2}`));
  const dcfLcrCell = ws.getCell(`C${sumStart + 2}`);
  dcfLcrCell.value = { formula: `IFERROR(C${sumStart + 1}/D${calcStart + 4},0)` };
  dcfLcrCell.numFmt = '#,##0.0"x"';
  applyFormula(dcfLcrCell);

  // Payback period (month when cumulative DCF > CAC * starting cohort)
  ws.getCell(`B${sumStart + 3}`).value = 'Payback Period (months):';
  ws.getCell(`B${sumStart + 3}`).font = { bold: true };
  applyNormal(ws.getCell(`B${sumStart + 3}`));
  const ppCell = ws.getCell(`C${sumStart + 3}`);
  // MATCH to find first month where cumulative DCF >= CAC * cohort
  // Build a MATCH formula across the cumulative row
  const firstCumCol = ws.getCell(cumRow, 3).address.replace(/\d+/, '');
  ppCell.value = { formula: `IFERROR(MATCH(D${calcStart + 4}*C${survRow},${firstCumCol}${cumRow}:${lastCumCol}${cumRow},1),">24")` };
  ppCell.numFmt = '0';
  applyFormula(ppCell);
}

function buildTargetProfitSheet(wb, draft, meta) {
  const ws = wb.addWorksheet('6. Target Profit Calculator', { properties: { tabColor: { argb: 'FFED7D31' } } });
  ws.columns = [{ width: 5 }, { width: 30 }, { width: 20 }, { width: 20 }];

  ws.getCell('B1').value = 'Target Profit Calculator';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
  ws.getCell('B2').value = 'Reverse-engineer: How much do you need to sell to hit your profit target?';
  ws.getCell('B2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  // Target Profit input
  ws.getCell('B4').value = 'Target Monthly Profit (\u20B9):';
  ws.getCell('B4').font = { bold: true };
  const tpCell = ws.getCell('C4');
  tpCell.value = 0;
  tpCell.numFmt = STYLES.currencyFormat;
  applyInput(tpCell);

  // Fixed costs summary
  ws.getCell('B6').value = 'Total Fixed Costs (Monthly):';
  const fcCell = ws.getCell('C6');
  fcCell.value = { formula: `'3D. Admin & Other Expenses'!D${meta.adminTotRow}+'1. HR Costs'!H${meta.hrTotRow}` };
  fcCell.numFmt = STYLES.currencyFormat;
  applyCrossRef(fcCell);

  // Required total contribution
  ws.getCell('B7').value = 'Required Total Contribution:';
  const rcCell = ws.getCell('C7');
  rcCell.value = { formula: `C4+C6` };
  rcCell.numFmt = STYLES.currencyFormat;
  applyFormula(rcCell);

  // Per-product required units
  const headers = ['#', 'Product', 'Revenue Mix %', 'Required Revenue', 'Required Units/Month'];
  const hRow = 9;
  headers.forEach((h, i) => {
    const cell = ws.getCell(hRow, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  const products = draft.products || [];
  const equalMix = products.length > 0 ? 1 / products.length : 0;

  products.forEach((prod, idx) => {
    const r = hRow + 1 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    applyNormal(ws.getCell(`A${r}`));

    ws.getCell(`B${r}`).value = prod.name;
    applyNormal(ws.getCell(`B${r}`));

    const mixCell = ws.getCell(`C${r}`);
    mixCell.value = equalMix;
    mixCell.numFmt = STYLES.percentFormat;
    applyInput(mixCell);

    const reqRevCell = ws.getCell(`D${r}`);
    reqRevCell.value = { formula: `C7*C${r}` };
    reqRevCell.numFmt = STYLES.currencyFormat;
    applyFormula(reqRevCell);

    // Required Units = Required Revenue / Contribution per unit (from Sheet 4)
    const pmRow = 4 + idx; // Product row in Product Market Mix
    const reqUnitsCell = ws.getCell(`E${r}`);
    reqUnitsCell.value = { formula: `IFERROR(ROUND(D${r}/'4. Product Market Mix'!G${pmRow},0),0)` };
    applyFormula(reqUnitsCell);
  });
}

function buildCashFlowSheet(wb, draft, meta) {
  const ws = wb.addWorksheet('7. Cash Flow', { properties: { tabColor: { argb: 'FF00B0F0' } } });

  // 12-month projection
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const cols = [{ width: 5 }, { width: 30 }];
  months.forEach(() => cols.push({ width: 14 }));
  cols.push({ width: 16 }); // Total
  ws.columns = cols;

  ws.getCell('B1').value = 'Cash Flow Projection \u2014 12 Months';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  // Growth assumption inputs
  ws.getCell('B2').value = 'Monthly Revenue Growth:';
  ws.getCell('B2').font = { bold: true, size: 10 };
  const growthCell = ws.getCell('C2');
  growthCell.value = draft.assumptions?.monthlyRevenueGrowth || 0.05;
  growthCell.numFmt = STYLES.percentFormat;
  applyInput(growthCell);

  ws.getCell('E2').value = 'Starting Cash Balance:';
  ws.getCell('E2').font = { bold: true, size: 10 };
  const cashBalCell = ws.getCell('G2');
  cashBalCell.value = draft.investmentAmount || 0;
  cashBalCell.numFmt = STYLES.currencyFormat;
  applyInput(cashBalCell);

  // Month headers
  ws.getCell('B3').value = '';
  applyHeader(ws.getCell('A3'));
  applyHeader(ws.getCell('B3'));
  months.forEach((m, i) => {
    const cell = ws.getCell(3, 3 + i);
    cell.value = m;
    applyHeader(cell);
  });
  const totHeader = ws.getCell(3, 15);
  totHeader.value = 'TOTAL';
  applyHeader(totHeader);

  // ── Compute reference row addresses for cross-sheet lookups ──
  const products = draft.products || [];
  const loans = draft.loans || [];

  // Use centralized row metadata
  const { hrTotRow, mktTotRow, adminTotRow, capexTotRow, financeTotRow, pmTotRow } = meta;

  // Geo Selector total row for COGS — sum of purchase costs * volumes from 3C
  const geoLastProdRow = 6 + products.length - 1;

  // ── Row layout (starting at row 4) ──
  // Row 4: REVENUE (section)
  // Row 5: Product Sales
  // Row 6: Other Income
  // Row 7: Total Revenue
  // Row 8: spacer
  // Row 9: EXPENSES (section)
  // Row 10: COGS / Manufacturing
  // Row 11: HR Costs
  // Row 12: Marketing Costs
  // Row 13: Admin Expenses
  // Row 14: Depreciation
  // Row 15: Loan EMI
  // Row 16: Total Expenses
  // Row 17: spacer
  // Row 18: NET CASH FLOW
  // Row 19: Cumulative Cash Flow

  const ROW = {
    REVENUE_SEC: 4,
    PRODUCT_SALES: 5,
    OTHER_INCOME: 6,
    TOTAL_REV: 7,
    SPACER1: 8,
    EXPENSE_SEC: 9,
    COGS: 10,
    HR: 11,
    MARKETING: 12,
    ADMIN: 13,
    DEPRECIATION: 14,
    LOAN_EMI: 15,
    TOTAL_EXP: 16,
    SPACER2: 17,
    NET_CF: 18,
    CUM_CF: 19,
  };

  // Section headers
  ws.getCell(`B${ROW.REVENUE_SEC}`).value = 'REVENUE';
  for (let c = 1; c <= 15; c++) applySection(ws.getCell(ROW.REVENUE_SEC, c));

  ws.getCell(`B${ROW.EXPENSE_SEC}`).value = 'EXPENSES';
  for (let c = 1; c <= 15; c++) applySection(ws.getCell(ROW.EXPENSE_SEC, c));

  // Spacers
  for (let c = 1; c <= 15; c++) { applyNormal(ws.getCell(ROW.SPACER1, c)); applyNormal(ws.getCell(ROW.SPACER2, c)); }

  // Row labels
  const dataRows = [
    { row: ROW.PRODUCT_SALES, label: 'Product Sales' },
    { row: ROW.OTHER_INCOME, label: 'Other Income' },
    { row: ROW.TOTAL_REV, label: 'Total Revenue' },
    { row: ROW.COGS, label: 'COGS / Manufacturing' },
    { row: ROW.HR, label: 'HR Costs' },
    { row: ROW.MARKETING, label: 'Marketing Costs' },
    { row: ROW.ADMIN, label: 'Admin Expenses' },
    { row: ROW.DEPRECIATION, label: 'Depreciation' },
    { row: ROW.LOAN_EMI, label: 'Loan EMI' },
    { row: ROW.TOTAL_EXP, label: 'Total Expenses' },
    { row: ROW.NET_CF, label: 'NET CASH FLOW' },
    { row: ROW.CUM_CF, label: 'Cumulative Cash Flow' },
  ];
  dataRows.forEach(({ row: r, label }) => {
    const bCell = ws.getCell(`B${r}`);
    bCell.value = label;
    applyNormal(ws.getCell(`A${r}`));
    applyNormal(bCell);
    bCell.font = { ...STYLES.normalFont, bold: true };
  });

  // ── Fill 12 months with formulas ──
  const colLetter = (colIdx) => ws.getCell(1, colIdx).address.replace(/\d+/, '');

  for (let m = 0; m < 12; m++) {
    const c = 3 + m; // column index (C=3, D=4, ..., N=14)
    const cl = colLetter(c);
    const prevCl = m > 0 ? colLetter(c - 1) : null;

    // ── Product Sales: Month 1 = Sheet 4 total monthly contribution, subsequent months grow ──
    const psCell = ws.getCell(ROW.PRODUCT_SALES, c);
    if (m === 0) {
      // Base revenue from Product Mix total monthly contribution (Sheet 4, col I, totRow)
      psCell.value = { formula: `'4. Product Market Mix'!I${pmTotRow}` };
    } else {
      // Previous month * (1 + growth rate)
      psCell.value = { formula: `${prevCl}${ROW.PRODUCT_SALES}*(1+$C$2)` };
    }
    psCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(psCell);

    // ── Other Income (manual input) ──
    const oiCell = ws.getCell(ROW.OTHER_INCOME, c);
    oiCell.value = 0;
    oiCell.numFmt = STYLES.currencyFormat;
    applyInput(oiCell);

    // ── Total Revenue = Product Sales + Other Income ──
    const trCell = ws.getCell(ROW.TOTAL_REV, c);
    trCell.value = { formula: `${cl}${ROW.PRODUCT_SALES}+${cl}${ROW.OTHER_INCOME}` };
    trCell.numFmt = STYLES.currencyFormat;
    applyFormula(trCell);

    // ── COGS: sum of (purchase cost * volume) from Geo Selector (3C) ──
    // Use total purchase cost * volume. For simplicity: sum of C column * F column in 3C
    const cogsCell = ws.getCell(ROW.COGS, c);
    if (products.length > 0) {
      // COGS = SUMPRODUCT of purchase costs and volumes from 3C
      cogsCell.value = { formula: `SUMPRODUCT('3C. Geo Selector'!C6:C${geoLastProdRow},'3C. Geo Selector'!F6:F${geoLastProdRow})` };
    } else {
      cogsCell.value = 0;
    }
    cogsCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(cogsCell);

    // ── HR Costs: monthly total from Sheet 1 ──
    const hrCell = ws.getCell(ROW.HR, c);
    hrCell.value = { formula: `'1. HR Costs'!H${hrTotRow}` };
    hrCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(hrCell);

    // ── Marketing Costs: monthly total from Sheet 2 ──
    const mktCell = ws.getCell(ROW.MARKETING, c);
    mktCell.value = { formula: `'2. Marketing Costs'!C${mktTotRow}` };
    mktCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(mktCell);

    // ── Admin Expenses: monthly total from Sheet 3D ──
    const admCell = ws.getCell(ROW.ADMIN, c);
    admCell.value = { formula: `'3D. Admin & Other Expenses'!D${adminTotRow}` };
    admCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(admCell);

    // ── Depreciation: monthly total from Sheet 3E ──
    const depCell = ws.getCell(ROW.DEPRECIATION, c);
    depCell.value = { formula: `'3E. Capital Expenses (CAPEX)'!G${capexTotRow}` };
    depCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(depCell);

    // ── Loan EMI: monthly total from Sheet 3F ──
    const emiCell = ws.getCell(ROW.LOAN_EMI, c);
    emiCell.value = { formula: `'3F. Finance Costs'!F${financeTotRow}` };
    emiCell.numFmt = STYLES.currencyFormat;
    applyCrossRef(emiCell);

    // ── Total Expenses = sum of COGS through EMI ──
    const teCell = ws.getCell(ROW.TOTAL_EXP, c);
    teCell.value = { formula: `SUM(${cl}${ROW.COGS}:${cl}${ROW.LOAN_EMI})` };
    teCell.numFmt = STYLES.currencyFormat;
    applyFormula(teCell);

    // ── Net Cash Flow = Total Revenue - Total Expenses ──
    const ncfCell = ws.getCell(ROW.NET_CF, c);
    ncfCell.value = { formula: `${cl}${ROW.TOTAL_REV}-${cl}${ROW.TOTAL_EXP}` };
    ncfCell.numFmt = STYLES.currencyFormat;
    applyFormula(ncfCell);

    // ── Cumulative Cash Flow ──
    const ccfCell = ws.getCell(ROW.CUM_CF, c);
    if (m === 0) {
      // Starting cash + first month net
      ccfCell.value = { formula: `$G$2+${cl}${ROW.NET_CF}` };
    } else {
      ccfCell.value = { formula: `${prevCl}${ROW.CUM_CF}+${cl}${ROW.NET_CF}` };
    }
    ccfCell.numFmt = STYLES.currencyFormat;
    applyFormula(ccfCell);
  }

  // ── TOTAL column (col O = 15) ──
  const totalCol = 15;
  const tcl = colLetter(totalCol);
  const sumRows = [ROW.PRODUCT_SALES, ROW.OTHER_INCOME, ROW.TOTAL_REV, ROW.COGS, ROW.HR, ROW.MARKETING, ROW.ADMIN, ROW.DEPRECIATION, ROW.LOAN_EMI, ROW.TOTAL_EXP, ROW.NET_CF];
  sumRows.forEach(r => {
    const cell = ws.getCell(r, totalCol);
    cell.value = { formula: `SUM(C${r}:N${r})` };
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  });

  // Cumulative total = last month's cumulative
  const cumTotCell = ws.getCell(ROW.CUM_CF, totalCol);
  cumTotCell.value = { formula: `N${ROW.CUM_CF}` };
  cumTotCell.numFmt = STYLES.currencyFormat;
  applyFormula(cumTotCell);

  // Bold the key summary rows
  [ROW.TOTAL_REV, ROW.TOTAL_EXP, ROW.NET_CF, ROW.CUM_CF].forEach(r => {
    ws.getCell(`B${r}`).font = { ...STYLES.normalFont, bold: true };
    for (let c = 3; c <= 15; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { ...cell.font, bold: true };
    }
  });
}

function buildKPIDashboardSheet(wb, draft, meta) {
  const ws = wb.addWorksheet('8. KPI Dashboard', { properties: { tabColor: { argb: 'FF00B050' } } });
  ws.columns = [{ width: 5 }, { width: 35 }, { width: 22 }, { width: 35 }];

  ws.getCell('B1').value = 'KPI Dashboard';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  // ── Compute reference rows ──
  const products = draft.products || [];

  // Use centralized row metadata
  const { hrTotRow, mktTotRow, adminTotRow, capexTotRow, financeTotRow, pmTotRow } = meta;

  // LTV result row (calculated in Sheet 5)
  const ltvCalcStart = 3 + 6 + 1; // params start=3, 5 param rows + 1 header, +1 gap
  const ltvResultRow = ltvCalcStart + 3; // Simple LTV is row 3 in calc section

  // Geo selector last product row
  const geoLastProdRow = 6 + products.length - 1;

  // Cash Flow rows
  const cfTotalRevRow = 7;
  const cfTotalExpRow = 16;
  const cfNetRow = 18;

  // ── KPI rows ──
  const hRow = 3;
  ['', 'KPI', 'Value', 'Formula/Source'].forEach((h, i) => {
    const cell = ws.getCell(hRow, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  let row = 4;

  // ── FINANCIAL KPIs section ──
  ws.getCell(`B${row}`).value = 'FINANCIAL KPIs';
  for (let c = 1; c <= 4; c++) applySection(ws.getCell(row, c));
  row++;

  // 1. Gross Margin %
  ws.getCell(`A${row}`).value = '1'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Gross Margin %'; applyNormal(ws.getCell(`B${row}`));
  const gm = ws.getCell(`C${row}`);
  // Total Contribution / Total Revenue from Product Mix
  gm.value = { formula: `IFERROR('4. Product Market Mix'!I${pmTotRow}/SUMPRODUCT('4. Product Market Mix'!E4:E${pmTotRow-1},'4. Product Market Mix'!H4:H${pmTotRow-1}),0)` };
  gm.numFmt = STYLES.percentFormat;
  applyFormula(gm);
  ws.getCell(`D${row}`).value = 'Total Contribution / Total Revenue'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // 2. Net Profit Margin %
  ws.getCell(`A${row}`).value = '2'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Net Profit Margin %'; applyNormal(ws.getCell(`B${row}`));
  const npm = ws.getCell(`C${row}`);
  npm.value = { formula: `IFERROR('7. Cash Flow'!O${cfNetRow}/'7. Cash Flow'!O${cfTotalRevRow},0)` };
  npm.numFmt = STYLES.percentFormat;
  applyFormula(npm);
  ws.getCell(`D${row}`).value = 'Annual Net Cash Flow / Annual Revenue'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // 3. Monthly Burn Rate
  ws.getCell(`A${row}`).value = '3'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Monthly Burn Rate (\u20B9)'; applyNormal(ws.getCell(`B${row}`));
  const burn = ws.getCell(`C${row}`);
  burn.value = { formula: `'1. HR Costs'!H${hrTotRow}+'2. Marketing Costs'!C${mktTotRow}+'3D. Admin & Other Expenses'!D${adminTotRow}+'3E. Capital Expenses (CAPEX)'!G${capexTotRow}+'3F. Finance Costs'!F${financeTotRow}` };
  burn.numFmt = STYLES.currencyFormat;
  applyFormula(burn);
  ws.getCell(`D${row}`).value = 'HR + Marketing + Admin + Dep + EMI'; applyNormal(ws.getCell(`D${row}`));
  const burnRow = row;
  row++;

  // 4. Runway (months)
  ws.getCell(`A${row}`).value = '4'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Runway (months)'; applyNormal(ws.getCell(`B${row}`));
  const runway = ws.getCell(`C${row}`);
  runway.value = { formula: `IFERROR(ROUND('7. Cash Flow'!G2/C${burnRow},1),0)` };
  runway.numFmt = '#,##0.0';
  applyFormula(runway);
  ws.getCell(`D${row}`).value = 'Starting Cash / Monthly Burn'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // 5. Break-Even Point (units)
  ws.getCell(`A${row}`).value = '5'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Break-Even Point (units)'; applyNormal(ws.getCell(`B${row}`));
  const be = ws.getCell(`C${row}`);
  // Fixed costs / weighted avg contribution per unit
  be.value = { formula: `IFERROR(ROUND(C${burnRow}/IFERROR('4. Product Market Mix'!I${pmTotRow}/SUM('4. Product Market Mix'!H4:H${pmTotRow-1}),1),0),0)` };
  be.numFmt = STYLES.numberFormat;
  applyFormula(be);
  ws.getCell(`D${row}`).value = 'Fixed Costs / Avg Contribution per Unit'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // ── OPERATIONAL KPIs section ──
  ws.getCell(`B${row}`).value = 'OPERATIONAL KPIs';
  for (let c = 1; c <= 4; c++) applySection(ws.getCell(row, c));
  row++;

  // 6. Revenue per Employee
  ws.getCell(`A${row}`).value = '6'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Revenue per Employee (\u20B9/mo)'; applyNormal(ws.getCell(`B${row}`));
  const rpe = ws.getCell(`C${row}`);
  rpe.value = { formula: `IFERROR(SUMPRODUCT('4. Product Market Mix'!E4:E${pmTotRow-1},'4. Product Market Mix'!H4:H${pmTotRow-1})/'1. HR Costs'!E${hrTotRow},0)` };
  rpe.numFmt = STYLES.currencyFormat;
  applyFormula(rpe);
  ws.getCell(`D${row}`).value = 'Monthly Revenue / Total Headcount'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // 7. Cost per Employee
  ws.getCell(`A${row}`).value = '7'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Cost per Employee (\u20B9/mo)'; applyNormal(ws.getCell(`B${row}`));
  const cpe = ws.getCell(`C${row}`);
  cpe.value = { formula: `IFERROR('1. HR Costs'!H${hrTotRow}/'1. HR Costs'!E${hrTotRow},0)` };
  cpe.numFmt = STYLES.currencyFormat;
  applyFormula(cpe);
  ws.getCell(`D${row}`).value = 'Monthly HR Cost / Total Headcount'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // 8. Capacity Utilization (input-based)
  ws.getCell(`A${row}`).value = '8'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Capacity Utilization'; applyNormal(ws.getCell(`B${row}`));
  const capUtil = ws.getCell(`C${row}`);
  capUtil.value = draft.assumptions?.capacityUtilization || 0.7;
  capUtil.numFmt = STYLES.percentFormat;
  applyInput(capUtil);
  ws.getCell(`D${row}`).value = 'User-defined (Actual Vol / Max Capacity)'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // ── MARKETING KPIs section ──
  ws.getCell(`B${row}`).value = 'MARKETING KPIs';
  for (let c = 1; c <= 4; c++) applySection(ws.getCell(row, c));
  row++;

  // 9. CAC
  ws.getCell(`A${row}`).value = '9'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Customer Acquisition Cost (\u20B9)'; applyNormal(ws.getCell(`B${row}`));
  const cac = ws.getCell(`C${row}`);
  cac.value = { formula: `'2. Marketing Costs'!G${mktTotRow}` };
  cac.numFmt = STYLES.currencyFormat;
  applyCrossRef(cac);
  ws.getCell(`D${row}`).value = 'Blended CAC from Marketing sheet'; applyNormal(ws.getCell(`D${row}`));
  const cacRow = row;
  row++;

  // 10. LTV:CAC Ratio
  ws.getCell(`A${row}`).value = '10'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'LTV:CAC Ratio'; applyNormal(ws.getCell(`B${row}`));
  const ltvcac = ws.getCell(`C${row}`);
  ltvcac.value = { formula: `IFERROR('5. Customer LTV Analysis'!D${ltvResultRow}/C${cacRow},0)` };
  ltvcac.numFmt = '#,##0.0"x"';
  applyFormula(ltvcac);
  ws.getCell(`D${row}`).value = 'Simple LTV / CAC'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // 11. Marketing ROI
  ws.getCell(`A${row}`).value = '11'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Marketing ROI'; applyNormal(ws.getCell(`B${row}`));
  const mroi = ws.getCell(`C${row}`);
  mroi.value = { formula: `IFERROR((SUMPRODUCT('4. Product Market Mix'!E4:E${pmTotRow-1},'4. Product Market Mix'!H4:H${pmTotRow-1})-'2. Marketing Costs'!C${mktTotRow})/'2. Marketing Costs'!C${mktTotRow},0)` };
  mroi.numFmt = '#,##0.0"x"';
  applyFormula(mroi);
  ws.getCell(`D${row}`).value = '(Revenue - Mkt Cost) / Mkt Cost'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // ── UNIT ECONOMICS SUMMARY section ──
  ws.getCell(`B${row}`).value = 'UNIT ECONOMICS SUMMARY';
  for (let c = 1; c <= 4; c++) applySection(ws.getCell(row, c));
  row++;

  // 12. Avg Revenue per Unit
  ws.getCell(`A${row}`).value = '12'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Avg Revenue per Unit (\u20B9)'; applyNormal(ws.getCell(`B${row}`));
  const arpu = ws.getCell(`C${row}`);
  arpu.value = { formula: `IFERROR(SUMPRODUCT('4. Product Market Mix'!E4:E${pmTotRow-1},'4. Product Market Mix'!H4:H${pmTotRow-1})/SUM('4. Product Market Mix'!H4:H${pmTotRow-1}),0)` };
  arpu.numFmt = STYLES.currencyFormat;
  applyFormula(arpu);
  ws.getCell(`D${row}`).value = 'Weighted avg sale price'; applyNormal(ws.getCell(`D${row}`));
  row++;

  // 13. Avg Contribution per Unit
  ws.getCell(`A${row}`).value = '13'; applyNormal(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = 'Avg Contribution per Unit (\u20B9)'; applyNormal(ws.getCell(`B${row}`));
  const acu = ws.getCell(`C${row}`);
  acu.value = { formula: `IFERROR('4. Product Market Mix'!I${pmTotRow}/SUM('4. Product Market Mix'!H4:H${pmTotRow-1}),0)` };
  acu.numFmt = STYLES.currencyFormat;
  applyFormula(acu);
  ws.getCell(`D${row}`).value = 'Total contribution / total units'; applyNormal(ws.getCell(`D${row}`));
}

function buildScenarioSheet(wb, draft, meta) {
  const ws = wb.addWorksheet('9. Scenario Analysis', { properties: { tabColor: { argb: 'FFFFC000' } } });
  ws.columns = [{ width: 5 }, { width: 30 }, { width: 18 }, { width: 18 }, { width: 18 }];

  ws.getCell('B1').value = 'Scenario Analysis \u2014 Best / Base / Worst';
  ws.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };

  // Use centralized row metadata
  const products = draft.products || [];
  const { hrTotRow, mktTotRow, adminTotRow, capexTotRow, financeTotRow, pmTotRow } = meta;

  const headers = ['', 'Metric', 'Best Case', 'Base Case', 'Worst Case'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

  // Row 4: Revenue Multiplier (input)
  ws.getCell('A4').value = '1'; applyNormal(ws.getCell('A4'));
  ws.getCell('B4').value = 'Revenue Multiplier'; applyNormal(ws.getCell('B4'));
  ws.getCell('C4').value = 1.2; applyInput(ws.getCell('C4'));
  ws.getCell('D4').value = 1.0; applyInput(ws.getCell('D4'));
  ws.getCell('E4').value = 0.7; applyInput(ws.getCell('E4'));

  // Row 5: Cost Multiplier (input)
  ws.getCell('A5').value = '2'; applyNormal(ws.getCell('A5'));
  ws.getCell('B5').value = 'Cost Multiplier'; applyNormal(ws.getCell('B5'));
  ws.getCell('C5').value = 0.9; applyInput(ws.getCell('C5'));
  ws.getCell('D5').value = 1.0; applyInput(ws.getCell('D5'));
  ws.getCell('E5').value = 1.15; applyInput(ws.getCell('E5'));

  // Row 6: Monthly Revenue = Product Mix total revenue * multiplier
  ws.getCell('A6').value = '3'; applyNormal(ws.getCell('A6'));
  ws.getCell('B6').value = 'Monthly Revenue (\u20B9)'; applyNormal(ws.getCell('B6'));
  for (const col of ['C', 'D', 'E']) {
    const cell = ws.getCell(`${col}6`);
    cell.value = { formula: `SUMPRODUCT('4. Product Market Mix'!E4:E${pmTotRow-1},'4. Product Market Mix'!H4:H${pmTotRow-1})*${col}4` };
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  }

  // Row 7: Monthly Costs = (HR + Marketing + Admin + Dep + EMI) * cost multiplier
  ws.getCell('A7').value = '4'; applyNormal(ws.getCell('A7'));
  ws.getCell('B7').value = 'Monthly Costs (\u20B9)'; applyNormal(ws.getCell('B7'));
  for (const col of ['C', 'D', 'E']) {
    const cell = ws.getCell(`${col}7`);
    cell.value = { formula: `('1. HR Costs'!H${hrTotRow}+'2. Marketing Costs'!C${mktTotRow}+'3D. Admin & Other Expenses'!D${adminTotRow}+'3E. Capital Expenses (CAPEX)'!G${capexTotRow}+'3F. Finance Costs'!F${financeTotRow})*${col}5` };
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  }

  // Row 8: Monthly Profit = Revenue - Costs
  ws.getCell('A8').value = '5'; applyNormal(ws.getCell('A8'));
  ws.getCell('B8').value = 'Monthly Profit (\u20B9)'; applyNormal(ws.getCell('B8'));
  for (const col of ['C', 'D', 'E']) {
    const cell = ws.getCell(`${col}8`);
    cell.value = { formula: `${col}6-${col}7` };
    cell.numFmt = STYLES.currencyFormat;
    applyFormula(cell);
  }

  // Row 9: Profit Margin %
  ws.getCell('A9').value = '6'; applyNormal(ws.getCell('A9'));
  ws.getCell('B9').value = 'Profit Margin %'; applyNormal(ws.getCell('B9'));
  for (const col of ['C', 'D', 'E']) {
    const cell = ws.getCell(`${col}9`);
    cell.value = { formula: `IFERROR(${col}8/${col}6,0)` };
    cell.numFmt = STYLES.percentFormat;
    applyFormula(cell);
  }

  // Row 10: Break-Even Months = Investment / Monthly Profit (if profit > 0)
  ws.getCell('A10').value = '7'; applyNormal(ws.getCell('A10'));
  ws.getCell('B10').value = 'Break-Even Months'; applyNormal(ws.getCell('B10'));
  for (const col of ['C', 'D', 'E']) {
    const cell = ws.getCell(`${col}10`);
    cell.value = { formula: `IFERROR(IF(${col}8>0,ROUND('7. Cash Flow'!G2/${col}8,1),"N/A"),"N/A")` };
    cell.numFmt = '#,##0.0';
    applyFormula(cell);
  }

  // Bold key rows
  [6, 7, 8].forEach(r => {
    ws.getCell(`B${r}`).font = { ...STYLES.normalFont, bold: true };
  });
}

export default generateWorkbook;
