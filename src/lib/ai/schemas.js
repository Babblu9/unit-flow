import { z } from 'zod';

/**
 * Zod schemas for structured LLM output.
 * Used with Vercel AI SDK's generateObject() to get typed business drafts.
 *
 * IMPORTANT: OpenAI structured output (strict mode) requires ALL properties
 * in every object to be listed in the JSON Schema 'required' array.
 * This means:
 *   - NO .optional() fields — use .nullable() instead
 *   - NO .default() values — the LLM must provide every field explicitly
 *   - Every nested z.object() must have ALL its keys required
 */

// ── Employee schema ──
export const EmployeeSchema = z.object({
  name: z.string().describe('Role/position title, e.g. "General Manager"'),
  role: z.string().describe('Brief role description'),
  department: z.string().describe('Department name'),
  category: z.enum(['management', 'white_collar', 'blue_collar']).describe('Employee category'),
  monthlySalary: z.number().describe('Monthly salary in INR'),
  count: z.number().describe('Number of people in this role (minimum 1)'),
});

// ── Marketing channel schema ──
export const MarketingChannelSchema = z.object({
  channel: z.string().describe('Marketing channel name, e.g. "Google Ads"'),
  monthlyBudget: z.number().describe('Monthly spend in INR'),
  expectedLeads: z.number().describe('Expected monthly leads'),
  conversionRate: z.number().describe('Lead-to-customer conversion rate, e.g. 0.05 for 5%'),
});

// ── Cost element (BOM) schema ──
export const CostElementSchema = z.object({
  name: z.string().describe('Cost element name, e.g. "Raw Material", "Packaging", "Direct Labor"'),
  category: z.enum(['raw_material', 'direct_labor', 'packaging', 'logistics', 'processing', 'overhead', 'other']).describe('Cost category for grouping and analysis'),
  cost: z.number().describe('Cost per unit in INR'),
  notes: z.string().nullable().describe('Brief explanation of how this cost was estimated, e.g. "Market rate for organic mushroom substrate per kg"'),
});

// ── Product schema ──
export const ProductSchema = z.object({
  name: z.string().describe('Product/service name'),
  group: z.string().describe('Product group/category'),
  unit: z.string().describe('Unit of measurement, e.g. "unit", "plate", "hour", "session"'),
  costElements: z.array(CostElementSchema).describe('Bill of materials / cost breakdown'),
  targetMargin: z.number().describe('Target margin %, e.g. 0.40 for 40%'),
  monthlyVolume: z.number().describe('Expected monthly sales volume'),
});

// ── City/geo pricing schema ──
export const CityProductPricingSchema = z.object({
  productName: z.string().describe('Must match a product name from the products array'),
  purchaseCost: z.number().describe('Purchase/production cost in this city in INR'),
  salePrice: z.number().describe('Sale price in this city in INR'),
});

export const CityPricingSchema = z.object({
  cityName: z.string().describe('City name'),
  products: z.array(CityProductPricingSchema).describe('Per-product pricing for this city'),
});

// ── Admin expense schema ──
export const AdminExpenseSchema = z.object({
  category: z.enum(['Rent', 'Utilities', 'Repairs & Maintenance', 'Insurance', 'Office & Admin']).describe('Expense category'),
  item: z.string().describe('Expense item description'),
  monthlyAmount: z.number().describe('Monthly amount in INR'),
});

// ── CAPEX item schema ──
export const CapexItemSchema = z.object({
  category: z.string().describe('Asset category, e.g. "Machinery"'),
  item: z.string().describe('Asset name'),
  cost: z.number().describe('Purchase cost in INR'),
  usefulLife: z.number().describe('Useful life in years for depreciation'),
});

// ── Loan schema ──
export const LoanSchema = z.object({
  name: z.string().describe('Loan description'),
  principal: z.number().describe('Loan principal in INR'),
  interestRate: z.number().describe('Annual interest rate, e.g. 0.12 for 12%'),
  tenureMonths: z.number().describe('Loan tenure in months'),
});

/* ════════════════════════════════════════════════════════
   Smart extraction schema — used on FIRST user message
   Extracts everything we can from natural language
   ════════════════════════════════════════════════════════ */
export const BusinessExtractionSchema = z.object({
  companyName: z.string().nullable().describe('Company name if mentioned'),
  businessDescription: z.string().describe('What the business does \u2014 summarize in 1-2 sentences'),
  productsServices: z.array(z.string()).describe('List of products/services mentioned'),
  targetCustomer: z.string().nullable().describe('Target customer segment if mentioned'),
  city: z.string().nullable().describe('City/location if mentioned'),
  businessStage: z.enum(['idea', 'early', 'growth', 'scale']).nullable().describe('Business stage if mentioned or inferable'),
  teamInfo: z.string().nullable().describe('Any team/employee info mentioned (roles, count, salaries)'),
  monthlyRevenue: z.number().nullable().describe('Monthly revenue if mentioned, in INR'),
  investmentAmount: z.number().nullable().describe('Investment/funding amount if mentioned, in INR'),
  monthlyRent: z.number().nullable().describe('Monthly rent if mentioned, in INR'),
  profitTarget: z.number().nullable().describe('Profit target if mentioned, in INR'),
  loanInfo: z.string().nullable().describe('Any loan/borrowing info mentioned'),
  costInfo: z.string().nullable().describe('Any cost breakdown info mentioned (salaries, tools, infra)'),
  confidenceScore: z.number().describe('0-1 score of how much info you have. 0.7+ means enough to generate a model'),
  missingCritical: z.array(z.string()).describe('List of critical missing items needed before generation (max 3 items)'),
});

// ── LTV parameters schema ──
export const LtvParamsSchema = z.object({
  avgOrderValue: z.number().describe('Average order value in INR'),
  purchaseFrequency: z.number().describe('Times per year a customer purchases'),
  retentionRate: z.number().describe('Annual retention rate, e.g. 0.7 for 70%'),
  grossMargin: z.number().describe('Gross margin rate, e.g. 0.4 for 40%'),
  discountRate: z.number().describe('Discount rate for LTV calculation, e.g. 0.1 for 10%'),
});

// ── Profit targets schema ──
export const ProfitTargetsSchema = z.object({
  targetMonthlyProfit: z.number().describe('Desired monthly profit in INR. If user did not specify, estimate a realistic target based on business stage and industry.'),
  rationale: z.string().describe('Brief explanation of why this profit target is realistic or how it was derived, e.g. "Based on 15% net margin for early-stage D2C brands"'),
});

// ── Cost optimization suggestion schema ──
export const CostSuggestionSchema = z.object({
  id: z.string().describe('Unique short ID like "rent-cowork", "hire-freelance", "mkt-organic"'),
  category: z.enum(['rent', 'hiring', 'marketing', 'operations', 'technology', 'finance', 'general']).describe('Which cost area this suggestion targets'),
  title: z.string().describe('Short actionable title, e.g. "Switch to coworking space"'),
  description: z.string().describe('2-3 sentence explanation of the suggestion and why it helps'),
  currentCost: z.number().describe('Current monthly cost for the affected item in INR'),
  suggestedCost: z.number().describe('Suggested monthly cost after optimization in INR'),
  monthlySavings: z.number().describe('Monthly savings in INR (currentCost - suggestedCost)'),
  impact: z.enum(['high', 'medium', 'low']).describe('Impact level on overall profitability'),
  tradeoffs: z.string().nullable().describe('Any downsides or tradeoffs of this suggestion'),
});

// ── Assumptions schema ──
export const AssumptionsSchema = z.object({
  workingDaysPerMonth: z.number().describe('Working days per month, typically 26'),
  hoursPerDay: z.number().describe('Working hours per day, typically 8'),
  employeeEfficiency: z.number().describe('Employee efficiency rate, e.g. 0.8 for 80%'),
  taxRate: z.number().describe('Tax rate, e.g. 0.25 for 25%'),
  inflationRate: z.number().describe('Annual inflation rate, e.g. 0.06 for 6%'),
  monthlyRevenueGrowth: z.number().describe('Month-over-month revenue growth rate, e.g. 0.05 for 5%'),
  capacityUtilization: z.number().describe('Capacity utilization rate, e.g. 0.7 for 70%'),
});

// ── Full business draft schema (what the LLM generates) ──
export const UnitEconomicsDraftSchema = z.object({
  companyName: z.string().describe('Company/business name'),
  industry: z.string().describe('Industry/sector'),
  businessStage: z.enum(['idea', 'early', 'growth', 'scale']).describe('Business stage'),
  investmentAmount: z.number().describe('Total investment/seed capital in INR (0 if not applicable)'),

  employees: z.array(EmployeeSchema).describe('Full team structure'),

  marketingChannels: z.array(MarketingChannelSchema).describe('Marketing plan — AI generated based on business stage and industry'),

  products: z.array(ProductSchema).describe('Products/services with cost breakdown and target margins'),

  cities: z.array(CityPricingSchema).describe('Up to 6 cities with geo-specific pricing'),

  adminExpenses: z.array(AdminExpenseSchema).describe('Admin & overhead expenses'),

  capexItems: z.array(CapexItemSchema).describe('Capital expenditure items'),

  loans: z.array(LoanSchema).describe('Loan/financing structure (empty array if no loans)'),

  ltvParams: LtvParamsSchema.describe('Customer LTV parameters'),

  assumptions: AssumptionsSchema.describe('Business assumptions for the model'),

  profitTargets: ProfitTargetsSchema.describe('Profit target — use user-specified target if available, otherwise estimate a realistic one'),

  costSuggestions: z.array(CostSuggestionSchema).describe('3-6 actionable cost optimization suggestions based on the business model. Include specific savings amounts. For early-stage/idea businesses, suggest lean alternatives (coworking, freelancers, organic marketing). For growth/scale, suggest efficiency gains.'),
});

/**
 * Lighter schemas for confirming/editing individual sections.
 * Note: 'changes' uses .nullable() instead of .optional() for OpenAI compatibility.
 */
export const HRConfirmSchema = z.object({
  employees: z.array(EmployeeSchema),
  confirmed: z.boolean(),
  changes: z.string().nullable().describe('Description of changes made, or null if none'),
});

export const ProductConfirmSchema = z.object({
  products: z.array(ProductSchema),
  confirmed: z.boolean(),
  changes: z.string().nullable().describe('Description of changes made, or null if none'),
});

export const CostConfirmSchema = z.object({
  adminExpenses: z.array(AdminExpenseSchema),
  capexItems: z.array(CapexItemSchema),
  loans: z.array(LoanSchema),
  confirmed: z.boolean(),
  changes: z.string().nullable().describe('Description of changes made, or null if none'),
});
