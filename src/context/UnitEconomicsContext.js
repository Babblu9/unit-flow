'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { mapDraftToTemplate } from '@/lib/excel/cellMapper';

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
    rationale: '',
    revenueMixOverrides: {},  // { [productId]: percentage }
  });

  // ── Cost Optimization Suggestions ──
  const [costSuggestions, setCostSuggestions] = useState([]);

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

  // ── Template cell overrides (from AI draft + user edits) ──
  // Shape: { sheetName: { cellAddr: value } }
  const [templateOverrides, setTemplateOverrides] = useState({});
  const [templateOverrideVersion, setTemplateOverrideVersion] = useState(0);

  // Apply a batch of overrides from AI (cellMapper output)
  const applyTemplateOverrides = useCallback((patches) => {
    setTemplateOverrides(prev => {
      const next = { ...prev };
      for (const [sheet, cells] of Object.entries(patches)) {
        next[sheet] = { ...(next[sheet] || {}), ...cells };
      }
      return next;
    });
    setTemplateOverrideVersion(v => v + 1);
  }, []);

  // Apply a single cell edit from user interaction
  const setTemplateCell = useCallback((sheetName, cellAddr, value) => {
    setTemplateOverrides(prev => ({
      ...prev,
      [sheetName]: { ...(prev[sheetName] || {}), [cellAddr]: value },
    }));
    setTemplateOverrideVersion(v => v + 1);
  }, []);

  // ── Rebuild templateOverrides from current context arrays ──
  // Called after any UI edit to keep Excel download in sync.
  const rebuildTemplateOverrides = useCallback((overrides = {}) => {
    // Reconstruct a draft-like object from current state
    const draft = {
      companyName: overrides.companyName || businessInfo.companyName || '',
      industry: overrides.industry || businessInfo.industry || '',
      businessStage: overrides.businessStage || businessInfo.businessStage || 'early',
      investmentAmount: Number(businessInfo.investmentAmount) || 0,
      employees: overrides.employees || employees,
      marketingChannels: overrides.marketingChannels || marketingChannels,
      products: overrides.products || products,
      cities: overrides.cities || cities,
      adminExpenses: overrides.adminExpenses || adminExpenses,
      capexItems: overrides.capexItems || capexItems,
      loans: overrides.loans || loans,
      ltvParams: overrides.ltvParams || ltvParams,
      assumptions: {
        workingDaysPerMonth: 26,
        hoursPerDay: 8,
        employeeEfficiency: 0.8,
        taxRate: 0.25,
        inflationRate: 0.06,
        monthlyRevenueGrowth: 0.05,
        capacityUtilization: 0.7,
      },
    };
    try {
      const patches = mapDraftToTemplate(draft, {
        companyName: draft.companyName,
        city: businessInfo.city,
      });
      applyTemplateOverrides(patches);
    } catch (e) {
      console.error('rebuildTemplateOverrides error:', e);
    }
  }, [businessInfo, employees, marketingChannels, products, cities, adminExpenses, capexItems, loans, ltvParams, applyTemplateOverrides]);

  // ── Update helpers for individual fields ──
  // Each updates the context array and then rebuilds template overrides.

  const updateEmployee = useCallback((index, field, value) => {
    setEmployees(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Rebuild after state update via setTimeout to ensure state is committed
      setTimeout(() => rebuildTemplateOverrides({ employees: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateProduct = useCallback((index, field, value) => {
    setProducts(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      setTimeout(() => rebuildTemplateOverrides({ products: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateProductCostElement = useCallback((productIndex, costIndex, field, value) => {
    setProducts(prev => {
      const next = [...prev];
      const costElements = [...(next[productIndex].costElements || [])];
      costElements[costIndex] = { ...costElements[costIndex], [field]: value };
      next[productIndex] = { ...next[productIndex], costElements };
      setTimeout(() => rebuildTemplateOverrides({ products: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateMarketingChannel = useCallback((index, field, value) => {
    setMarketingChannels(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      setTimeout(() => rebuildTemplateOverrides({ marketingChannels: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateAdminExpense = useCallback((index, field, value) => {
    setAdminExpenses(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      setTimeout(() => rebuildTemplateOverrides({ adminExpenses: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateCapexItem = useCallback((index, field, value) => {
    setCapexItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      setTimeout(() => rebuildTemplateOverrides({ capexItems: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateLoan = useCallback((index, field, value) => {
    setLoans(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      setTimeout(() => rebuildTemplateOverrides({ loans: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateLtvParam = useCallback((field, value) => {
    setLtvParams(prev => {
      const next = { ...prev, [field]: value };
      setTimeout(() => rebuildTemplateOverrides({ ltvParams: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateCityProduct = useCallback((cityIndex, productIndex, field, value) => {
    setCities(prev => {
      const next = [...prev];
      const cityProducts = [...(next[cityIndex].products || [])];
      cityProducts[productIndex] = { ...cityProducts[productIndex], [field]: value };
      next[cityIndex] = { ...next[cityIndex], products: cityProducts };
      setTimeout(() => rebuildTemplateOverrides({ cities: next }), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  const updateProfitTarget = useCallback((field, value) => {
    setProfitTargets(prev => {
      const next = { ...prev, [field]: value };
      setTimeout(() => rebuildTemplateOverrides(), 0);
      return next;
    });
  }, [rebuildTemplateOverrides]);

  /** Mark a cost suggestion as accepted (status: 'accepted') */
  const acceptSuggestion = useCallback((suggestionId) => {
    setCostSuggestions(prev =>
      prev.map(s => s.id === suggestionId ? { ...s, status: 'accepted' } : s)
    );
  }, []);

  /** Mark a cost suggestion as dismissed (status: 'dismissed') */
  const dismissSuggestion = useCallback((suggestionId) => {
    setCostSuggestions(prev =>
      prev.map(s => s.id === suggestionId ? { ...s, status: 'dismissed' } : s)
    );
  }, []);

  // ── Loading state for conversation switching ──
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

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

  // ── Load a saved conversation by ID ──
  const loadConversation = useCallback(async (id) => {
    try {
      setIsLoadingConversation(true);
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load conversation');
      }
      const { conversation } = await res.json();

      // Restore chat state
      setConversationId(conversation.id);
      setMessages(conversation.messages || []);
      setCurrentStep(conversation.screenPhase || 'welcome');
      setCompletion(conversation.completion || 0);

      // Restore model state if present
      const ms = conversation.modelState;
      if (ms) {
        if (ms.businessInfo)        setBusinessInfoState(prev => ({ ...prev, ...ms.businessInfo }));
        if (ms.employees)           setEmployees(ms.employees);
        if (ms.marketingChannels)   setMarketingChannels(ms.marketingChannels);
        if (ms.products)            setProducts(ms.products);
        if (ms.cities)              setCities(ms.cities);
        if (ms.selectedCity)        setSelectedCity(ms.selectedCity);
        if (ms.adminExpenses)       setAdminExpenses(ms.adminExpenses);
        if (ms.capexItems)          setCapexItems(ms.capexItems);
        if (ms.loans)               setLoans(ms.loans);
        if (ms.productToggles)      setProductToggles(ms.productToggles);
        if (ms.ltvParams)           setLtvParams(ms.ltvParams);
        if (ms.profitTargets)       setProfitTargets(ms.profitTargets);
        if (ms.costSuggestions)     setCostSuggestions(ms.costSuggestions);
        if (ms.scenarios)           setScenarios(ms.scenarios);
      }

      setActiveSheet('Instructions & Guide');
      setIsGenerating(false);
    } catch (err) {
      console.error('loadConversation error:', err);
    } finally {
      setIsLoadingConversation(false);
    }
  }, []);

  // ── Reset to blank state for a new conversation ──
  const resetConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setCurrentStep('welcome');
    setCompletion(0);
    setIsGenerating(false);
    setBusinessInfoState({
      companyName: '',
      businessDescription: '',
      productsServices: '',
      targetCustomer: '',
      city: '',
      businessStage: '',
      teamSize: '',
      monthlyRevenue: '',
      investmentAmount: '',
      monthlyRent: '',
      profitTarget: '',
      loansBorrowings: '',
    });
    setEmployees([]);
    setMarketingChannels([]);
    setProducts([]);
    setCities([]);
    setSelectedCity('');
    setAdminExpenses([]);
    setCapexItems([]);
    setLoans([]);
    setProductToggles({});
    setLtvParams({
      avgOrderValue: 0,
      purchaseFrequency: 12,
      retentionRate: 0.7,
      grossMargin: 0.4,
      discountRate: 0.1,
    });
    setProfitTargets({
      targetMonthlyProfit: 0,
      rationale: '',
      revenueMixOverrides: {},
    });
    setCostSuggestions([]);
    setScenarios({
      best:  { revenueMultiplier: 1.2, costMultiplier: 0.9 },
      base:  { revenueMultiplier: 1.0, costMultiplier: 1.0 },
      worst: { revenueMultiplier: 0.7, costMultiplier: 1.15 },
    });
    setExcelPatches([]);
    setExcelPatchVersion(0);
    patchQueueRef.current = [];
    setTemplateOverrides({});
    setTemplateOverrideVersion(0);
    setActiveSheet('Instructions & Guide');
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
    '10. Smart Suggestions',
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

      // Cost Optimization Suggestions
      costSuggestions, setCostSuggestions,
      acceptSuggestion, dismissSuggestion,

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

      // Template overrides (for new template-based viewer)
      templateOverrides, templateOverrideVersion,
      applyTemplateOverrides, setTemplateCell,

      // Update helpers for inline editing
      updateEmployee, updateProduct, updateProductCostElement,
      updateMarketingChannel, updateAdminExpense, updateCapexItem,
      updateLoan, updateLtvParam, updateCityProduct, updateProfitTarget,
      rebuildTemplateOverrides,

      // Conversation management
      loadConversation, resetConversation, isLoadingConversation,
    }}>
      {children}
    </UnitEconomicsContext.Provider>
  );
}

export const useUnitEconomics = () => useContext(UnitEconomicsContext);
