import { z } from 'zod';

/**
 * Zod schemas for structured LLM output.
 * Used with Vercel AI SDK's generateObject() to get typed business drafts.
 */

// ── Employee schema ──
export const EmployeeSchema = z.object({
  name: z.string().describe('Role/position title, e.g. "General Manager"'),
  role: z.string().describe('Brief role description'),
  department: z.string().describe('Department name'),
  category: z.enum(['management', 'white_collar', 'blue_collar']).describe('Employee category'),
  monthlySalary: z.number().describe('Monthly salary in INR'),
  count: z.number().default(1).describe('Number of people in this role'),
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
  name: z.string().describe('Cost element name, e.g. "Raw Material"'),
  cost: z.number().describe('Cost per unit in INR'),
});

// ── Product schema ──
export const ProductSchema = z.object({
  name: z.string().describe('Product/service name'),
  group: z.string().describe('Product group/category'),
  unit: z.string().default('unit').describe('Unit of measurement'),
  costElements: z.array(CostElementSchema).describe('Bill of materials / cost breakdown'),
  targetMargin: z.number().describe('Target margin %, e.g. 0.40 for 40%'),
  monthlyVolume: z.number().describe('Expected monthly sales volume'),
});

// ── City/geo pricing schema ──
export const CityPricingSchema = z.object({
  cityName: z.string(),
  products: z.array(z.object({
    productName: z.string(),
    purchaseCost: z.number(),
    salePrice: z.number(),
  })),
});

// ── Admin expense schema ──
export const AdminExpenseSchema = z.object({
  category: z.enum(['Rent', 'Utilities', 'Repairs & Maintenance', 'Insurance', 'Office & Admin']),
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

// ── Full business draft schema (what the LLM generates) ──
export const UnitEconomicsDraftSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  businessStage: z.enum(['idea', 'early', 'growth', 'scale']),

  employees: z.array(EmployeeSchema).describe('Full team structure'),

  marketingChannels: z.array(MarketingChannelSchema).describe('Marketing plan \u2014 AI generated based on business stage'),

  products: z.array(ProductSchema).describe('Products/services with cost breakdown and target margins'),

  cities: z.array(CityPricingSchema).describe('Up to 6 cities with geo-specific pricing'),

  adminExpenses: z.array(AdminExpenseSchema).describe('Admin & overhead expenses'),

  capexItems: z.array(CapexItemSchema).describe('Capital expenditure items'),

  loans: z.array(LoanSchema).describe('Loan/financing structure'),

  ltvParams: z.object({
    avgOrderValue: z.number(),
    purchaseFrequency: z.number().describe('Times per year'),
    retentionRate: z.number().describe('Annual retention rate, e.g. 0.7'),
    grossMargin: z.number(),
    discountRate: z.number().default(0.1),
  }).describe('Customer LTV parameters'),

  assumptions: z.object({
    workingDaysPerMonth: z.number().default(26),
    hoursPerDay: z.number().default(8),
    employeeEfficiency: z.number().default(0.8),
    taxRate: z.number().default(0.25),
    inflationRate: z.number().default(0.06),
  }),
});

/**
 * Lighter schema for confirming/editing individual sections
 */
export const HRConfirmSchema = z.object({
  employees: z.array(EmployeeSchema),
  confirmed: z.boolean(),
  changes: z.string().optional().describe('Description of changes made'),
});

export const ProductConfirmSchema = z.object({
  products: z.array(ProductSchema),
  confirmed: z.boolean(),
  changes: z.string().optional(),
});

export const CostConfirmSchema = z.object({
  adminExpenses: z.array(AdminExpenseSchema),
  capexItems: z.array(CapexItemSchema),
  loans: z.array(LoanSchema),
  confirmed: z.boolean(),
  changes: z.string().optional(),
});
