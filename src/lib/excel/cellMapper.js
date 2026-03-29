/**
 * cellMapper.js — Maps AI draft data into exact template cell addresses
 *
 * The template has FIXED row slots for each section. The AI fills what it can;
 * unused rows get zeroed out. This preserves all 2,395 formulas and cross-sheet
 * references without any row insertion/deletion.
 *
 * Template structure (row slots):
 *   HR Costs:       Management 6-11 (6 slots), White-collar 15-23 (9 slots), Blue-collar 27-38 (12 slots)
 *   Marketing:      Channels 5-18 (14 slots)
 *   Manufacturing:  Products spread across 5 groups (22 total slots)
 *   Geo Purchase:   6 city blocks × 22 products each
 *   Geo Sale:       22 products × 6 cities
 *   Admin Expenses: 5 sections (A-E) with specific row ranges
 *   CAPEX:          6 sections (A-F) with specific row ranges
 *   Finance:        Loans rows 6-12 (7 slots)
 *   Cash Flow:      12 months × inflow/outflow rows
 *   LTV:            Input assumptions rows 5-13
 *
 * Returns: { sheetName: { cellAddr: newValue } }
 */

/* ════════════════════════════════════════════════════════
   TEMPLATE ROW MAPS — exact row numbers from the template
   ════════════════════════════════════════════════════════ */

const HR_SHEET = '1. Unit Economics - HR Costs';
const HR_SLOTS = {
  management:   { start: 6,  end: 11, count: 6 },
  white_collar: { start: 15, end: 23, count: 9 },
  blue_collar:  { start: 27, end: 38, count: 12 },
};
// Input columns for HR: F=count, G=empType, H=minSalary, I=maxSalary, K=workDays, L=hours, N=efficiency, T=benefits
// Label columns: B=sNo, C=category, D=designation, E=department

const MARKETING_SHEET = '2. Marketing Costs';
const MARKETING_SLOTS = { start: 5, end: 18, count: 14 };
// B=channel, C=budget(input), D=leads(input), F=convRate(input), I=revPerCust(input)

const MANUFACTURING_SHEET = '3. Manufacturing Costs';
// 5 product groups with specific row ranges:
const MFG_GROUPS = [
  { name: 'MUSHROOMS',    start: 5,  end: 12, count: 8 },
  { name: 'VEGETABLES',   start: 14, end: 18, count: 5 },
  { name: 'AGRI INPUTS',  start: 20, end: 22, count: 3 },
  { name: 'PROCESSED',    start: 24, end: 26, count: 3 },
  { name: 'CONSULTING',   start: 28, end: 30, count: 3 },
];
// Total: 22 product slots
// Input columns: E-N (9 cost element columns + N=wastage%)

const GEO_PURCHASE_SHEET = '3A. Geo Purchase Costs';
// 6 city blocks, each 22 product rows + headers
const GEO_CITIES = [
  { name: 'Hyderabad', headerRow: 5,  dataStart: 6,  dataEnd: 27 },
  { name: 'Bangalore', headerRow: 32, dataStart: 33, dataEnd: 54 },
  { name: 'Chennai',   headerRow: 59, dataStart: 60, dataEnd: 81 },
  { name: 'Mumbai',    headerRow: 86, dataStart: 87, dataEnd: 108 },
  { name: 'Delhi NCR', headerRow: 113, dataStart: 114, dataEnd: 135 },
  { name: 'Pune',      headerRow: 140, dataStart: 141, dataEnd: 162 },
];

const GEO_SALE_SHEET = '3B. Geo Sale Prices';
// Products in rows 5-26 (22 rows), cities in columns E-J (6 cities)
const GEO_SALE_COLS = ['E', 'F', 'G', 'H', 'I', 'J']; // HYD, BLR, CHE, MUM, DEL, PUN

const GEO_SELECTOR_SHEET = '3C. Geo Selector';
// C9 = purchase city (input), C10 = sale city (input)
// F16-F37: target margin % (input), I16-I37: monthly volume (input)

const ADMIN_SHEET = '3D. Admin & Other Expenses';
const ADMIN_SECTIONS = [
  { name: 'Rent & Facility',       start: 6,  end: 10, count: 5 },
  { name: 'Utilities & Consumables', start: 15, end: 21, count: 7 },
  { name: 'Repairs & Maintenance',  start: 26, end: 31, count: 6 },
  { name: 'Insurance & Compliance', start: 36, end: 43, count: 8 },
  { name: 'Office & Admin',         start: 48, end: 56, count: 9 },
];
// Input columns: C=monthly amount (input)

const CAPEX_SHEET = '3E. Capital Expenses (CAPEX)';
const CAPEX_SECTIONS = [
  { name: 'Land & Civil Works',      start: 6,  end: 13, count: 8 },
  { name: 'Plant & Machinery',       start: 18, end: 25, count: 8 },
  { name: 'Equipment & Tools',       start: 30, end: 37, count: 8 },
  { name: 'Vehicles & Transport',    start: 42, end: 44, count: 3 },
  { name: 'Technology & Software',   start: 49, end: 54, count: 6 },
  { name: 'Pre-operative Expenses',  start: 59, end: 64, count: 6 },
];
// Input columns: B=item, C=qty(input), D=unitCost(input), F=depRate(input)

const FINANCE_SHEET = '3F. Finance Costs';
const LOAN_SLOTS = { start: 6, end: 12, count: 7 };
// B=loanType, C=principal(input), D=interestRate(input), E=tenure(input)

const RATE_CARD_SHEET = '1.1 Rate Card';
const RATE_CARD_SLOTS = {
  management:   { start: 6,  end: 11, count: 6 },
  white_collar: { start: 13, end: 21, count: 9 },
  blue_collar:  { start: 23, end: 34, count: 12 },
};
// Label columns: B=sNo, C=category, D=designation, E=department

const MARKETING_PRODUCT_SLOTS = { start: 41, end: 52, count: 12 };
// Section C: A=sNo, B=productName, C=revenueMix%(input)

const CASHFLOW_SHEET = '7. Cash Flow';
// C-N = months (Apr-Mar), row 5-8 inflows, row 12-26 outflows

const LTV_SHEET = '5. Customer LTV Analysis';
// C5=AOV(input), C6=frequency(input), C10=retention(input), C12=discountRate(input)

const TARGET_SHEET = '6. Target Profit Calculator';
// C4=targetProfit(input), C10-C31=mix%(input), E10-E31=targetMargin%(input)

/**
 * Map AI draft data into template cell addresses.
 *
 * @param {object} draft - The AI-generated UnitEconomicsDraft
 * @param {object} options - { companyName, city }
 * @returns {object} - { sheetName: { cellAddr: newValue } }
 */
export function mapDraftToTemplate(draft, options = {}) {
  const patches = {};

  function set(sheet, addr, value) {
    if (!patches[sheet]) patches[sheet] = {};
    // Allow empty strings (to clear labels in unused slots); reject only null/undefined
    if (value !== null && value !== undefined) {
      patches[sheet][addr] = value;
    }
  }

  // ── 1. HR Costs ──
  mapEmployees(draft.employees || [], set);

  // ── 1.1 Rate Card (designation labels — mirrors HR sheet) ──
  mapRateCardLabels(draft.employees || [], set);

  // ── 2. Marketing Costs ──
  mapMarketing(draft.marketingChannels || [], set);

  // ── 2. Marketing Costs — Section C product allocation ──
  mapMarketingProducts(draft.products || [], set);

  // ── 3. Manufacturing Costs ──
  mapProducts(draft.products || [], set);

  // ── 3A. Geo Purchase Costs ──
  mapGeoPurchase(draft.products || [], draft.cities || [], set);

  // ── 3B. Geo Sale Prices ──
  mapGeoSale(draft.products || [], draft.cities || [], set);

  // ── 3C. Geo Selector ──
  mapGeoSelector(draft, options, set);

  // ── 3D. Admin & Other Expenses ──
  mapAdmin(draft.adminExpenses || [], set);

  // ── 3E. Capital Expenses (CAPEX) ──
  mapCapex(draft.capexItems || [], set);

  // ── 3F. Finance Costs ──
  mapLoans(draft.loans || [], set);

  // ── 5. Customer LTV Analysis ──
  mapLTV(draft.ltvParams || {}, set);

  // ── 6. Target Profit Calculator ──
  mapTargetProfit(draft, set);

  // ── 7. Cash Flow ──
  mapCashFlow(draft, set);

  // ── Instructions & Guide — company name ──
  if (draft.companyName) {
    // Row 2 of Instructions has the company description
    set('Instructions & Guide', 'A2', `Unit Economics model for ${draft.companyName}`);
  }

  // ── Update subtitle on HR sheet ──
  if (draft.companyName) {
    set(HR_SHEET, 'A2', `Employee cost structure for ${draft.companyName} | Green cells = editable inputs, Blue cells = auto-calculated formulas`);
  }

  return patches;
}

/* ── Mapping functions ── */

function mapEmployees(employees, set) {
  const buckets = {
    management: employees.filter(e => e.category === 'management'),
    white_collar: employees.filter(e => e.category === 'white_collar'),
    blue_collar: employees.filter(e => e.category === 'blue_collar'),
  };

  for (const [category, slot] of Object.entries(HR_SLOTS)) {
    const emps = buckets[category] || [];
    for (let i = 0; i < slot.count; i++) {
      const row = slot.start + i;
      const emp = emps[i];
      if (emp) {
        set(HR_SHEET, `B${row}`, i + 1); // S.No
        set(HR_SHEET, `C${row}`, categoryLabel(category));
        set(HR_SHEET, `D${row}`, emp.name || emp.designation || '');
        set(HR_SHEET, `E${row}`, emp.department || '');
        set(HR_SHEET, `F${row}`, emp.count || 1); // Staff count (INPUT)
        set(HR_SHEET, `G${row}`, emp.employmentType || 'Full-time');
        // Min/Max salary — use monthlySalary as base, ±20%
        const salary = emp.monthlySalary || 0;
        set(HR_SHEET, `H${row}`, Math.round(salary * 0.8));  // Min (INPUT)
        set(HR_SHEET, `I${row}`, Math.round(salary * 1.2));  // Max (INPUT)
        set(HR_SHEET, `K${row}`, 26);   // Working days (INPUT)
        set(HR_SHEET, `L${row}`, 8);    // Hours/day (INPUT)
        set(HR_SHEET, `N${row}`, 0.8);  // Efficiency (INPUT)
        set(HR_SHEET, `T${row}`, category === 'management' ? 0.2 : (category === 'white_collar' ? 0.2 : 0.15)); // Benefits % (INPUT)
      } else {
        // Clear unused slot — zero out input cells
        set(HR_SHEET, `B${row}`, '');
        set(HR_SHEET, `C${row}`, '');
        set(HR_SHEET, `D${row}`, '');
        set(HR_SHEET, `E${row}`, '');
        set(HR_SHEET, `F${row}`, 0);
        set(HR_SHEET, `G${row}`, '');
        set(HR_SHEET, `H${row}`, 0);
        set(HR_SHEET, `I${row}`, 0);
        set(HR_SHEET, `K${row}`, 26);
        set(HR_SHEET, `L${row}`, 8);
        set(HR_SHEET, `N${row}`, 0.8);
        set(HR_SHEET, `T${row}`, 0);
      }
    }
  }
}

function categoryLabel(cat) {
  if (cat === 'management') return 'Management';
  if (cat === 'white_collar') return 'White-Collar';
  if (cat === 'blue_collar') return 'Blue-Collar';
  return cat;
}

function mapMarketing(channels, set) {
  for (let i = 0; i < MARKETING_SLOTS.count; i++) {
    const row = MARKETING_SLOTS.start + i;
    const ch = channels[i];
    if (ch) {
      set(MARKETING_SHEET, `A${row}`, i + 1);
      set(MARKETING_SHEET, `B${row}`, ch.channel || '');
      set(MARKETING_SHEET, `C${row}`, ch.monthlyBudget || 0);          // INPUT
      set(MARKETING_SHEET, `D${row}`, ch.expectedLeads || 0);          // INPUT
      set(MARKETING_SHEET, `F${row}`, ch.conversionRate || 0.05);      // INPUT
      set(MARKETING_SHEET, `I${row}`, ch.revenuePerCustomer || 0);     // INPUT
    } else {
      set(MARKETING_SHEET, `A${row}`, '');
      set(MARKETING_SHEET, `B${row}`, '');
      set(MARKETING_SHEET, `C${row}`, 0);
      set(MARKETING_SHEET, `D${row}`, 0);
      set(MARKETING_SHEET, `F${row}`, 0);
      set(MARKETING_SHEET, `I${row}`, 0);
    }
  }
}

function mapProducts(products, set) {
  // Products fill across the 5 manufacturing groups sequentially
  // We assign products to groups based on the AI's `group` field or sequentially
  let productIdx = 0;
  for (const group of MFG_GROUPS) {
    for (let i = 0; i < group.count; i++) {
      const row = group.start + i;
      const prod = products[productIdx];
      if (prod && productIdx < products.length) {
        set(MANUFACTURING_SHEET, `A${row}`, productIdx + 1);
        set(MANUFACTURING_SHEET, `B${row}`, prod.name || '');
        set(MANUFACTURING_SHEET, `C${row}`, `P${String(productIdx + 1).padStart(2, '0')}`);
        set(MANUFACTURING_SHEET, `D${row}`, prod.group || group.name);
        // Map cost elements to columns E-M
        const costs = prod.costElements || [];
        const costCols = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
        for (let c = 0; c < costCols.length; c++) {
          set(MANUFACTURING_SHEET, `${costCols[c]}${row}`, costs[c] ? costs[c].cost : 0);
        }
        set(MANUFACTURING_SHEET, `N${row}`, 0.05); // Wastage % default 5%
        productIdx++;
      } else {
        // Clear unused slot
        set(MANUFACTURING_SHEET, `A${row}`, '');
        set(MANUFACTURING_SHEET, `B${row}`, '');
        set(MANUFACTURING_SHEET, `C${row}`, '');
        set(MANUFACTURING_SHEET, `D${row}`, '');
        for (const col of ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) {
          set(MANUFACTURING_SHEET, `${col}${row}`, 0);
        }
        set(MANUFACTURING_SHEET, `N${row}`, 0);
      }
    }
  }
}

function mapGeoPurchase(products, cities, set) {
  // For each city block, fill product LABELS (A-D) + cost data (E-N)
  for (let cityIdx = 0; cityIdx < GEO_CITIES.length; cityIdx++) {
    const geoCity = GEO_CITIES[cityIdx];
    const city = cities[cityIdx];
    let productIdx = 0;

    for (let row = geoCity.dataStart; row <= geoCity.dataEnd; row++) {
      const prod = products[productIdx];
      if (prod && productIdx < products.length) {
        // Write product labels (columns A-D) — clears Blue Leaves names
        set(GEO_PURCHASE_SHEET, `A${row}`, productIdx + 1); // S.No
        set(GEO_PURCHASE_SHEET, `B${row}`, prod.name || ''); // Product name
        set(GEO_PURCHASE_SHEET, `C${row}`, `P${String(productIdx + 1).padStart(2, '0')}`); // Product code
        set(GEO_PURCHASE_SHEET, `D${row}`, prod.group || ''); // Product group

        // Find city-specific pricing if available
        const cityPricing = city?.products?.find(p => p.productName === prod.name);
        const costs = prod.costElements || [];
        const costCols = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
        for (let c = 0; c < costCols.length; c++) {
          const baseCost = costs[c] ? costs[c].cost : 0;
          // Adjust by ±10% per city for variation
          const factor = 1 + (cityIdx * 0.03 - 0.05);
          set(GEO_PURCHASE_SHEET, `${costCols[c]}${row}`, Math.round(baseCost * factor));
        }
        set(GEO_PURCHASE_SHEET, `N${row}`, 0.05);
      } else {
        // Clear unused slot — labels AND cost data
        set(GEO_PURCHASE_SHEET, `A${row}`, '');
        set(GEO_PURCHASE_SHEET, `B${row}`, '');
        set(GEO_PURCHASE_SHEET, `C${row}`, '');
        set(GEO_PURCHASE_SHEET, `D${row}`, '');
        for (const col of ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) {
          set(GEO_PURCHASE_SHEET, `${col}${row}`, 0);
        }
        set(GEO_PURCHASE_SHEET, `N${row}`, 0);
      }
      productIdx++;
    }
  }
}

function mapGeoSale(products, cities, set) {
  // Row 5-26 products: labels in A-D, sale prices in E-J (6 cities)
  for (let pIdx = 0; pIdx < 22; pIdx++) {
    const row = 5 + pIdx;
    const prod = products[pIdx];

    if (prod) {
      // Write product labels (columns A-D) — clears Blue Leaves names
      set(GEO_SALE_SHEET, `A${row}`, pIdx + 1); // S.No
      set(GEO_SALE_SHEET, `B${row}`, prod.name || ''); // Product name
      set(GEO_SALE_SHEET, `C${row}`, `P${String(pIdx + 1).padStart(2, '0')}`); // Product code
      set(GEO_SALE_SHEET, `D${row}`, prod.group || ''); // Product group
    } else {
      // Clear unused slot labels
      set(GEO_SALE_SHEET, `A${row}`, '');
      set(GEO_SALE_SHEET, `B${row}`, '');
      set(GEO_SALE_SHEET, `C${row}`, '');
      set(GEO_SALE_SHEET, `D${row}`, '');
    }

    // Write sale prices per city
    for (let cIdx = 0; cIdx < 6; cIdx++) {
      const col = GEO_SALE_COLS[cIdx];
      if (prod) {
        const city = cities[cIdx];
        const cityProd = city?.products?.find(p => p.productName === prod.name);
        const salePrice = cityProd?.salePrice || (prod.targetMargin > 0
          ? Math.round(prod.costElements?.reduce((s, c) => s + c.cost, 0) / (1 - prod.targetMargin))
          : 0);
        set(GEO_SALE_SHEET, `${col}${row}`, salePrice);
      } else {
        set(GEO_SALE_SHEET, `${col}${row}`, 0);
      }
    }
  }
}

function mapGeoSelector(draft, options, set) {
  const city = options.city || draft.cities?.[0]?.cityName || 'Hyderabad';
  set(GEO_SELECTOR_SHEET, 'C9', city);  // Purchase geo (INPUT)
  set(GEO_SELECTOR_SHEET, 'C10', city); // Sale geo (INPUT)

  // Fill target margins and volumes
  const products = draft.products || [];
  for (let i = 0; i < 22; i++) {
    const row = 16 + i;
    const prod = products[i];
    if (prod) {
      set(GEO_SELECTOR_SHEET, `F${row}`, prod.targetMargin || 0.4);       // Target margin (INPUT)
      set(GEO_SELECTOR_SHEET, `I${row}`, prod.monthlyVolume || 0);        // Monthly volume (INPUT)
    } else {
      set(GEO_SELECTOR_SHEET, `F${row}`, 0);
      set(GEO_SELECTOR_SHEET, `I${row}`, 0);
    }
  }
}

function mapAdmin(adminExpenses, set) {
  // Map expenses to matching sections
  const sectionMap = {
    'Rent':                        0,
    'Rent & Facility':             0,
    'Utilities':                   1,
    'Utilities & Consumables':     1,
    'Repairs & Maintenance':       2,
    'Insurance':                   3,
    'Insurance & Compliance':      3,
    'Office & Admin':              4,
  };

  // Group expenses by section
  const buckets = [[], [], [], [], []];
  for (const exp of adminExpenses) {
    const sIdx = sectionMap[exp.category] ?? 4; // default to Office & Admin
    buckets[sIdx].push(exp);
  }

  for (let s = 0; s < ADMIN_SECTIONS.length; s++) {
    const section = ADMIN_SECTIONS[s];
    const exps = buckets[s];
    for (let i = 0; i < section.count; i++) {
      const row = section.start + i;
      const exp = exps[i];
      if (exp) {
        set(ADMIN_SHEET, `B${row}`, exp.item || '');
        set(ADMIN_SHEET, `C${row}`, exp.monthlyAmount || 0); // INPUT
      } else {
        set(ADMIN_SHEET, `B${row}`, '');
        set(ADMIN_SHEET, `C${row}`, 0);
      }
    }
  }
}

function mapCapex(capexItems, set) {
  // Map items to sections based on category
  const sectionMap = {
    'Land & Civil Works':     0,
    'Land':                   0,
    'Civil Works':            0,
    'Plant & Machinery':      1,
    'Machinery':              1,
    'Equipment & Tools':      2,
    'Equipment':              2,
    'Tools':                  2,
    'Vehicles & Transport':   3,
    'Vehicles':               3,
    'Transport':              3,
    'Technology & Software':  4,
    'Technology':             4,
    'Software':               4,
    'Pre-operative':          5,
    'Pre-operative Expenses': 5,
  };

  const buckets = [[], [], [], [], [], []];
  for (const item of capexItems) {
    const sIdx = sectionMap[item.category] ?? 2; // default to Equipment
    buckets[sIdx].push(item);
  }

  for (let s = 0; s < CAPEX_SECTIONS.length; s++) {
    const section = CAPEX_SECTIONS[s];
    const items = buckets[s];
    for (let i = 0; i < section.count; i++) {
      const row = section.start + i;
      const item = items[i];
      if (item) {
        set(CAPEX_SHEET, `B${row}`, item.item || '');
        set(CAPEX_SHEET, `C${row}`, 1);                                    // Qty (INPUT)
        set(CAPEX_SHEET, `D${row}`, item.cost || 0);                       // Unit cost (INPUT)
        set(CAPEX_SHEET, `F${row}`, item.usefulLife > 0 ? 1 / item.usefulLife : 0.1); // Dep rate (INPUT)
      } else {
        set(CAPEX_SHEET, `B${row}`, '');
        set(CAPEX_SHEET, `C${row}`, 0);
        set(CAPEX_SHEET, `D${row}`, 0);
        set(CAPEX_SHEET, `F${row}`, 0);
      }
    }
  }
}

function mapLoans(loans, set) {
  for (let i = 0; i < LOAN_SLOTS.count; i++) {
    const row = LOAN_SLOTS.start + i;
    const loan = loans[i];
    if (loan) {
      set(FINANCE_SHEET, `B${row}`, loan.name || '');
      set(FINANCE_SHEET, `C${row}`, loan.principal || 0);      // INPUT
      set(FINANCE_SHEET, `D${row}`, loan.interestRate || 0);    // INPUT
      set(FINANCE_SHEET, `E${row}`, loan.tenureMonths || 0);    // INPUT
    } else {
      set(FINANCE_SHEET, `B${row}`, '');
      set(FINANCE_SHEET, `C${row}`, 0);
      set(FINANCE_SHEET, `D${row}`, 0);
      set(FINANCE_SHEET, `E${row}`, 0);
    }
  }
}

/**
 * Rate Card (Sheet 1.1) — update designation labels to match HR sheet.
 * The Rate Card is 100% formula-driven for numbers, but designation/dept labels are static text.
 */
function mapRateCardLabels(employees, set) {
  const buckets = {
    management:   employees.filter(e => e.category === 'management'),
    white_collar: employees.filter(e => e.category === 'white_collar'),
    blue_collar:  employees.filter(e => e.category === 'blue_collar'),
  };

  let serialNo = 1;
  for (const [category, slot] of Object.entries(RATE_CARD_SLOTS)) {
    const emps = buckets[category] || [];
    for (let i = 0; i < slot.count; i++) {
      const row = slot.start + i;
      const emp = emps[i];
      if (emp) {
        set(RATE_CARD_SHEET, `B${row}`, serialNo);
        set(RATE_CARD_SHEET, `C${row}`, categoryLabel(category));
        set(RATE_CARD_SHEET, `D${row}`, emp.name || emp.designation || '');
        set(RATE_CARD_SHEET, `E${row}`, emp.department || '');
        serialNo++;
      } else {
        set(RATE_CARD_SHEET, `B${row}`, '');
        set(RATE_CARD_SHEET, `C${row}`, '');
        set(RATE_CARD_SHEET, `D${row}`, '');
        set(RATE_CARD_SHEET, `E${row}`, '');
      }
    }
  }
}

/**
 * Marketing Section C — product-wise marketing cost allocation.
 * Rows 41-52: product name + revenue mix % (12 product slots).
 */
function mapMarketingProducts(products, set) {
  const total = products.length || 1;
  for (let i = 0; i < MARKETING_PRODUCT_SLOTS.count; i++) {
    const row = MARKETING_PRODUCT_SLOTS.start + i;
    const prod = products[i];
    if (prod) {
      set(MARKETING_SHEET, `A${row}`, i + 1);
      set(MARKETING_SHEET, `B${row}`, prod.name || '');
      set(MARKETING_SHEET, `C${row}`, prod.revenueMix || +(1 / total).toFixed(4)); // Revenue mix % (INPUT)
    } else {
      set(MARKETING_SHEET, `A${row}`, '');
      set(MARKETING_SHEET, `B${row}`, '');
      set(MARKETING_SHEET, `C${row}`, 0);
    }
  }
}

function mapLTV(ltvParams, set) {
  set(LTV_SHEET, 'C5', ltvParams.avgOrderValue || 0);      // AOV (INPUT)
  set(LTV_SHEET, 'C6', ltvParams.purchaseFrequency || 0);   // Frequency (INPUT)
  set(LTV_SHEET, 'C10', ltvParams.retentionRate || 0.7);    // Retention (INPUT)
  set(LTV_SHEET, 'C12', ltvParams.discountRate || 0.1);     // Discount rate (INPUT)
}

function mapTargetProfit(draft, set) {
  // C4 = target monthly profit (INPUT)
  const profitTarget = draft.profitTargets?.targetMonthlyProfit || 100000;
  set(TARGET_SHEET, 'C4', profitTarget);

  // Mix % and target margins for each product
  const products = draft.products || [];
  const total = products.length || 1;
  for (let i = 0; i < 22; i++) {
    const row = 10 + i;
    const prod = products[i];
    if (prod) {
      set(TARGET_SHEET, `C${row}`, 1 / total);           // Equal mix % (INPUT)
      set(TARGET_SHEET, `E${row}`, prod.targetMargin || 0.4); // Margin (INPUT)
    } else {
      set(TARGET_SHEET, `C${row}`, 0);
      set(TARGET_SHEET, `E${row}`, 0);
    }
  }
}

function mapCashFlow(draft, set) {
  // Simple: use monthly revenue estimate for all 12 months
  // User can customize in the HTML editor
  const monthlyRevenue = draft.products?.reduce((sum, p) => {
    const totalCost = p.costElements?.reduce((s, c) => s + c.cost, 0) || 0;
    const salePrice = p.targetMargin > 0 ? totalCost / (1 - p.targetMargin) : totalCost;
    return sum + salePrice * (p.monthlyVolume || 0);
  }, 0) || 0;

  const months = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
  for (let m = 0; m < 12; m++) {
    const col = months[m];
    // Growth factor: small monthly increase
    const growthFactor = 1 + (m * (draft.assumptions?.monthlyRevenueGrowth || 0.05));
    set(CASHFLOW_SHEET, `${col}5`, Math.round(monthlyRevenue * growthFactor)); // Sales revenue (INPUT)
    set(CASHFLOW_SHEET, `${col}6`, 0); // Other income (INPUT)
  }
}

/* ── Export mapping metadata for the HTML renderer ── */
export const TEMPLATE_METADATA = {
  HR_SHEET, HR_SLOTS,
  MARKETING_SHEET, MARKETING_SLOTS,
  MANUFACTURING_SHEET, MFG_GROUPS,
  GEO_PURCHASE_SHEET, GEO_CITIES,
  GEO_SALE_SHEET, GEO_SALE_COLS,
  GEO_SELECTOR_SHEET,
  ADMIN_SHEET, ADMIN_SECTIONS,
  CAPEX_SHEET, CAPEX_SECTIONS,
  FINANCE_SHEET, LOAN_SLOTS,
  LTV_SHEET,
  TARGET_SHEET,
  CASHFLOW_SHEET,
};
