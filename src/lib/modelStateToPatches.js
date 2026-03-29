/**
 * Convert the UnitEconomicsContext state into a flat array of Excel cell patches.
 * Each patch: { sheet: string, cell: string, value: string|number }
 *
 * Used when the user edits data in the UI to keep the Excel file in sync.
 * The Excel template builder creates the initial workbook; this module handles
 * incremental updates.
 */

/**
 * Map full model state to Excel patches.
 * @param {Object} state - The full state object from UnitEconomicsContext
 * @returns {Array<{sheet: string, cell: string, value: any}>}
 */
export function modelStateToPatches(state) {
  const patches = [];

  // ── Business info → Instructions sheet ──
  if (state.businessInfo) {
    const bi = state.businessInfo;
    patches.push({ sheet: 'Instructions & Guide', cell: 'B2', value: `${bi.companyName || 'Company'} \u2014 Unit Flow by OnEasy` });
  }

  // ── HR Costs (Sheet 1) ──
  if (state.employees?.length) {
    // Assumptions row
    patches.push({ sheet: '1. HR Costs', cell: 'C2', value: state.assumptions?.workingDaysPerMonth || 26 });
    patches.push({ sheet: '1. HR Costs', cell: 'E2', value: state.assumptions?.hoursPerDay || 8 });
    patches.push({ sheet: '1. HR Costs', cell: 'G2', value: state.assumptions?.employeeEfficiency || 0.8 });

    const categories = ['management', 'white_collar', 'blue_collar'];
    let row = 5; // After header row 4

    for (const cat of categories) {
      const catEmps = state.employees.filter(e => e.category === cat);
      if (catEmps.length === 0) continue;
      row++; // Category section header row

      catEmps.forEach(emp => {
        patches.push({ sheet: '1. HR Costs', cell: `B${row}`, value: emp.name });
        patches.push({ sheet: '1. HR Costs', cell: `C${row}`, value: emp.department });
        patches.push({ sheet: '1. HR Costs', cell: `D${row}`, value: emp.category });
        patches.push({ sheet: '1. HR Costs', cell: `E${row}`, value: emp.count || 1 });
        patches.push({ sheet: '1. HR Costs', cell: `F${row}`, value: emp.monthlySalary });
        row++;
      });
    }
  }

  // ── Marketing (Sheet 2) ──
  if (state.marketingChannels?.length) {
    state.marketingChannels.forEach((ch, idx) => {
      const r = 5 + idx;
      patches.push({ sheet: '2. Marketing Costs', cell: `B${r}`, value: ch.channel });
      patches.push({ sheet: '2. Marketing Costs', cell: `C${r}`, value: ch.monthlyBudget });
      patches.push({ sheet: '2. Marketing Costs', cell: `D${r}`, value: ch.expectedLeads });
      patches.push({ sheet: '2. Marketing Costs', cell: `E${r}`, value: ch.conversionRate });
    });
  }

  // ── Products (Sheet 3) ──
  if (state.products?.length) {
    state.products.forEach((prod, idx) => {
      const r = 5 + idx;
      patches.push({ sheet: '3. Manufacturing Costs', cell: `B${r}`, value: prod.name });
      patches.push({ sheet: '3. Manufacturing Costs', cell: `C${r}`, value: prod.group });

      // Cost elements in columns D onwards
      (prod.costElements || []).forEach((el, eIdx) => {
        const col = String.fromCharCode(68 + eIdx); // D, E, F, ...
        patches.push({ sheet: '3. Manufacturing Costs', cell: `${col}${r}`, value: el.cost });
      });
    });
  }

  // ── Admin Expenses (Sheet 3D) ──
  if (state.adminExpenses?.length) {
    let row = 4;
    const categories = ['Rent', 'Utilities', 'Repairs & Maintenance', 'Insurance', 'Office & Admin'];

    for (const cat of categories) {
      const catExps = state.adminExpenses.filter(e => e.category === cat);
      if (catExps.length === 0) continue;
      row++; // Section header

      catExps.forEach(exp => {
        patches.push({ sheet: '3D. Admin & Other Expenses', cell: `B${row}`, value: exp.category });
        patches.push({ sheet: '3D. Admin & Other Expenses', cell: `C${row}`, value: exp.item });
        patches.push({ sheet: '3D. Admin & Other Expenses', cell: `D${row}`, value: exp.monthlyAmount });
        row++;
      });
    }
  }

  // ── CAPEX (Sheet 3E) ──
  if (state.capexItems?.length) {
    state.capexItems.forEach((item, idx) => {
      const r = 4 + idx;
      patches.push({ sheet: '3E. Capital Expenses (CAPEX)', cell: `B${r}`, value: item.category });
      patches.push({ sheet: '3E. Capital Expenses (CAPEX)', cell: `C${r}`, value: item.item });
      patches.push({ sheet: '3E. Capital Expenses (CAPEX)', cell: `D${r}`, value: item.cost });
      patches.push({ sheet: '3E. Capital Expenses (CAPEX)', cell: `E${r}`, value: item.usefulLife });
    });
  }

  // ── Loans (Sheet 3F) ──
  if (state.loans?.length) {
    state.loans.forEach((loan, idx) => {
      const r = 5 + idx;
      patches.push({ sheet: '3F. Finance Costs', cell: `B${r}`, value: loan.name });
      patches.push({ sheet: '3F. Finance Costs', cell: `C${r}`, value: loan.principal });
      patches.push({ sheet: '3F. Finance Costs', cell: `D${r}`, value: loan.interestRate });
      patches.push({ sheet: '3F. Finance Costs', cell: `E${r}`, value: loan.tenureMonths });
    });
  }

  // ── LTV params (Sheet 5) ──
  if (state.ltvParams) {
    const ltv = state.ltvParams;
    patches.push({ sheet: '5. Customer LTV Analysis', cell: 'C4', value: ltv.avgOrderValue || 0 });
    patches.push({ sheet: '5. Customer LTV Analysis', cell: 'C5', value: ltv.purchaseFrequency || 12 });
    patches.push({ sheet: '5. Customer LTV Analysis', cell: 'C6', value: ltv.retentionRate || 0.7 });
    patches.push({ sheet: '5. Customer LTV Analysis', cell: 'C7', value: ltv.grossMargin || 0.4 });
    patches.push({ sheet: '5. Customer LTV Analysis', cell: 'C8', value: ltv.discountRate || 0.1 });
  }

  // ── Scenarios (Sheet 9) ──
  if (state.scenarios) {
    const s = state.scenarios;
    patches.push({ sheet: '9. Scenario Analysis', cell: 'C4', value: s.best?.revenueMultiplier || 1.2 });
    patches.push({ sheet: '9. Scenario Analysis', cell: 'D4', value: s.base?.revenueMultiplier || 1.0 });
    patches.push({ sheet: '9. Scenario Analysis', cell: 'E4', value: s.worst?.revenueMultiplier || 0.7 });
    patches.push({ sheet: '9. Scenario Analysis', cell: 'C5', value: s.best?.costMultiplier || 0.9 });
    patches.push({ sheet: '9. Scenario Analysis', cell: 'D5', value: s.base?.costMultiplier || 1.0 });
    patches.push({ sheet: '9. Scenario Analysis', cell: 'E5', value: s.worst?.costMultiplier || 1.15 });
  }

  return patches;
}

/**
 * Convert a single data action into patches.
 * Used for incremental updates from chat DATA tags.
 */
export function dataActionToPatches(action) {
  if (!action?.type) return [];

  switch (action.type) {
    case 'setEmployee': {
      const r = 6 + (action.index || 0);
      return [
        { sheet: '1. HR Costs', cell: `B${r}`, value: action.name },
        { sheet: '1. HR Costs', cell: `C${r}`, value: action.department },
        { sheet: '1. HR Costs', cell: `E${r}`, value: action.count || 1 },
        { sheet: '1. HR Costs', cell: `F${r}`, value: action.monthlySalary },
      ];
    }
    case 'setMarketingChannel': {
      const r = 5 + (action.index || 0);
      return [
        { sheet: '2. Marketing Costs', cell: `B${r}`, value: action.channel },
        { sheet: '2. Marketing Costs', cell: `C${r}`, value: action.monthlyBudget },
        { sheet: '2. Marketing Costs', cell: `D${r}`, value: action.expectedLeads },
        { sheet: '2. Marketing Costs', cell: `E${r}`, value: action.conversionRate },
      ];
    }
    case 'setAdminExpense': {
      const r = 5 + (action.index || 0);
      return [
        { sheet: '3D. Admin & Other Expenses', cell: `C${r}`, value: action.item },
        { sheet: '3D. Admin & Other Expenses', cell: `D${r}`, value: action.monthlyAmount },
      ];
    }
    default:
      return [];
  }
}
