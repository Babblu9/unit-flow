'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const UnitEconomicsContext = createContext();

/**
 * 17-sheet Unit Economics state management.
 * Mirrors the Fina AI FinancialContext pattern but adapted for unit economics sheets:
 *
 * Sheet 1:  HR Costs (employees array)
 * Sheet 1.1: Rate Card (auto-derived from HR)
 * Sheet 2:  Marketing Costs (channels, funnel, CAC)
 * Sheet 3:  Manufacturing/COGS Costs (products x cost elements)
 * Sheet 3A: Geo Purchase Costs
 * Sheet 3B: Geo Sale Prices
 * Sheet 3C: Geo Selector + Monthly P&L per product
 * Sheet 3D: Admin & Other Expenses
 * Sheet 3E: Capital Expenses (CAPEX)
 * Sheet 3F: Finance Costs (Loans)
 * Sheet 4:  Product Market Mix
 * Sheet 5:  Customer LTV Analysis
 * Sheet 6:  Target Profit Calculator
 * Sheet 7:  Cash Flow
 * Sheet 8:  KPI Dashboard
 * Sheet 9:  Scenario Analysis
 * Sheet 0:  Instructions & Guide
 */
export function UnitEconomicsProvider({ children }) {

  // ── Business basics ──
  const [businessInfo, setBusinessInfoState] = useState({
    companyName: '',
    businessDescription: '',
    productsServices: '',
    targetCustomer: '',
    city: '',
    businessStage: '',  // idea | early | growth | scale
    teamSize: '',
    monthlyRevenue: '',
    investmentAmount: '',
    monthlyRent: '',
    profitTarget: '',
    loansBorrowings: '',
  });

  // ── HR Costs (Sheet 1) ──
  const [employees, setEmployees] = useState([]);
  // Each: { id, name, role, department, category: 'management'|'white_collar'|'blue_collar',
  //         monthlySalary, workingDays: 26, hoursPerDay: 8, efficiency: 0.8 }

  // ── Marketing (Sheet 2) ──
  const [marketingChannels, setMarketingChannels] = useState([]);
  // Each: { id, channel, monthlyBudget, expectedLeads, conversionRate }

  // ── Products / COGS (Sheet 3) ──
  const [products, setProducts] = useState([]);
  // Each: { id, name, group, costElements: [{name, cost}], targetMargin, salePrice, unit }

  // ── Geo data (Sheets 3A, 3B, 3C) ──
  const [cities, setCities] = useState([]);
  // Each: { name, products: [{ productId, purchaseCost, salePrice }] }
  const [selectedCity, setSelectedCity] = useState('');

  // ── Admin Expenses (Sheet 3D) ──
  const [adminExpenses, setAdminExpenses] = useState([]);
  // Each: { id, category, item, monthlyAmount }
  // Categories: Rent, Utilities, Repairs, Insurance, Office

  // ── CAPEX (Sheet 3E) ──
  const [capexItems, setCapexItems] = useState([]);
  // Each: { id, category, item, cost, usefulLife, depreciationMethod: 'SLM' }

  // ── Finance / Loans (Sheet 3F) ──
  const [loans, setLoans] = useState([]);
  // Each: { id, name, principal, interestRate, tenureMonths, emiType: 'reducing' }

  // ── Product Market Mix toggles (Sheet 4) ──
  const [productToggles, setProductToggles] = useState({});
  // { [productId]: true/false } for YES/NO toggle

  // ── LTV parameters (Sheet 5) ──
  const [ltvParams, setLtvParams] = useState({
    avgOrderValue: 0,
    purchaseFrequency: 12,
    retentionRate: 0.7,
    grossMargin: 0.4,
    discountRate: 0.1,
  });

  // ── Target Profit (Sheet 6) ──
  const [profitTargets, setProfitTargets] = useState({
    targetMonthlyProfit: 0,
    revenueMixOverrides: {},  // { [productId]: percentage }
  });

  // ── Scenario Analysis (Sheet 9) ──
  const [scenarios, setScenarios] = useState({
    best:  { revenueMultiplier: 1.2, costMultiplier: 0.9 },
    base:  { revenueMultiplier: 1.0, costMultiplier: 1.0 },
    worst: { revenueMultiplier: 0.7, costMultiplier: 1.15 },
  });

  // ── Active spreadsheet tab ──
  const [activeSheet, setActiveSheet] = useState('Instructions & Guide');
  const [flashingSheet, setFlashingSheet] = useState(null);

  // ── Chat & conversation state ──
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [completion, setCompletion] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Excel patches ──
  const [excelPatches, setExcelPatches] = useState([]);
  const [excelPatchVersion, setExcelPatchVersion] = useState(0);
  const patchQueueRef = useRef([]);
  const patchTimerRef = useRef(null);

  // ── Flash animation helper ──
  const flashSheet = useCallback((sheetName) => {
    setFlashingSheet(sheetName);
    setTimeout(() => setFlashingSheet(null), 1500);
  }, []);

  const navigateToSheet = useCallback((sheetName) => {
    setActiveSheet(sheetName);
    flashSheet(sheetName);
  }, [flashSheet]);

  // ── Patch Excel (debounced batch write) ──
  const patchExcel = useCallback((patches) => {
    if (!patches || patches.length === 0) return;
    const stamped = patches.map(p => ({ ...p, timestamp: Date.now() }));
    patchQueueRef.current = [...patchQueueRef.current, ...stamped];

    if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    patchTimerRef.current = setTimeout(async () => {
      const batch = patchQueueRef.current;
      patchQueueRef.current = [];
      if (batch.length === 0) return;

      setExcelPatches(prev => [...prev, ...batch]);
      setExcelPatchVersion(v => v + 1);

      try {
        const res = await fetch('/api/excel-fill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patches: batch }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.warn('Excel fill warning:', body);
        }
      } catch (err) {
        console.error('Excel fill error:', err);
      }
    }, 300);
  }, []);

  // ── Business info setter ──
  const setBusinessInfo = useCallback((patch) => {
    setBusinessInfoState(prev => ({ ...prev, ...patch }));
  }, []);

  // ── Sheet name constants ──
  const SHEET_NAMES = [
    'Instructions & Guide',
    '1. HR Costs',
    '1.1 Rate Card',
    '2. Marketing Costs',
    '3. Manufacturing Costs',
    '3A. Geo Purchase Costs',
    '3B. Geo Sale Prices',
    '3C. Geo Selector',
    '3D. Admin & Other Expenses',
    '3E. Capital Expenses (CAPEX)',
    '3F. Finance Costs',
    '4. Product Market Mix',
    '5. Customer LTV Analysis',
    '6. Target Profit Calculator',
    '7. Cash Flow',
    '8. KPI Dashboard',
    '9. Scenario Analysis',
  ];

  return (
    <UnitEconomicsContext.Provider value={{
      // Business basics
      businessInfo, setBusinessInfo,

      // HR (Sheet 1)
      employees, setEmployees,

      // Marketing (Sheet 2)
      marketingChannels, setMarketingChannels,

      // Products / COGS (Sheet 3)
      products, setProducts,

      // Geo (Sheets 3A-3C)
      cities, setCities,
      selectedCity, setSelectedCity,

      // Admin (Sheet 3D)
      adminExpenses, setAdminExpenses,

      // CAPEX (Sheet 3E)
      capexItems, setCapexItems,

      // Loans (Sheet 3F)
      loans, setLoans,

      // Product Market Mix (Sheet 4)
      productToggles, setProductToggles,

      // LTV (Sheet 5)
      ltvParams, setLtvParams,

      // Target Profit (Sheet 6)
      profitTargets, setProfitTargets,

      // Scenarios (Sheet 9)
      scenarios, setScenarios,

      // Spreadsheet navigation
      activeSheet, setActiveSheet,
      flashingSheet, navigateToSheet,
      SHEET_NAMES,

      // Chat state
      messages, setMessages,
      conversationId, setConversationId,
      currentStep, setCurrentStep,
      completion, setCompletion,
      isGenerating, setIsGenerating,

      // Excel patches
      excelPatches, excelPatchVersion, setExcelPatchVersion, patchExcel,
    }}>
      {children}
    </UnitEconomicsContext.Provider>
  );
}

export const useUnitEconomics = () => useContext(UnitEconomicsContext);
