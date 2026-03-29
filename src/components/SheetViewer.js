'use client';

import { useUnitEconomics } from '@/context/UnitEconomicsContext';
import { FileSpreadsheet, ChevronRight } from 'lucide-react';

/**
 * SheetViewer — Right side of the split layout.
 * Shows a tab bar of all 17 sheets and displays sheet content
 * from the context state (not from the Excel file — Excel is write-only output).
 */
export default function SheetViewer() {
  const {
    activeSheet, setActiveSheet,
    flashingSheet,
    SHEET_NAMES,
    businessInfo,
    employees,
    marketingChannels,
    products,
    adminExpenses,
    capexItems,
    loans,
    ltvParams,
    scenarios,
    cities,
    completion,
  } = useUnitEconomics();

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Sheet tabs */}
      <div className="flex overflow-x-auto bg-white border-b border-slate-200 excel-scroll">
        {SHEET_NAMES.map((name) => (
          <button
            key={name}
            onClick={() => setActiveSheet(name)}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
              activeSheet === name
                ? 'border-navy text-navy bg-blue-50/50'
                : flashingSheet === name
                  ? 'border-green-500 text-green-700 bg-green-50 cell-flash'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Sheet content */}
      <div className="flex-1 overflow-auto p-4 excel-scroll">
        {completion < 60 ? (
          <EmptyState />
        ) : (
          <SheetContent
            sheetName={activeSheet}
            data={{ businessInfo, employees, marketingChannels, products, adminExpenses, capexItems, loans, ltvParams, scenarios, cities }}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
      <FileSpreadsheet className="w-16 h-16 mb-4 opacity-30" />
      <p className="text-sm font-medium mb-1">Your model will appear here</p>
      <p className="text-xs">Complete the chat to see your 17-sheet Unit Economics model</p>
    </div>
  );
}

function SheetContent({ sheetName, data }) {
  switch (sheetName) {
    case 'Instructions & Guide':
      return <InstructionsView data={data} />;
    case '1. HR Costs':
      return <HRView employees={data.employees} />;
    case '1.1 Rate Card':
      return <RateCardView employees={data.employees} />;
    case '2. Marketing Costs':
      return <MarketingView channels={data.marketingChannels} />;
    case '3. Manufacturing Costs':
      return <ManufacturingView products={data.products} />;
    case '3D. Admin & Other Expenses':
      return <AdminView expenses={data.adminExpenses} />;
    case '3E. Capital Expenses (CAPEX)':
      return <CapexView items={data.capexItems} />;
    case '3F. Finance Costs':
      return <FinanceView loans={data.loans} />;
    case '4. Product Market Mix':
      return <ProductMixView products={data.products} />;
    case '5. Customer LTV Analysis':
      return <LTVView params={data.ltvParams} />;
    case '9. Scenario Analysis':
      return <ScenarioView scenarios={data.scenarios} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
          Sheet preview for "{sheetName}" will be available in the Excel download.
        </div>
      );
  }
}

/* ── Sub-views for each sheet ── */

function InstructionsView({ data }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-navy">{data.businessInfo?.companyName || 'Your Company'} — Unit Economics Model</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoCard label="Company" value={data.businessInfo?.companyName || '—'} />
        <InfoCard label="Stage" value={data.businessInfo?.businessStage || '—'} />
        <InfoCard label="City" value={data.businessInfo?.city || '—'} />
        <InfoCard label="Team" value={data.employees?.length ? `${data.employees.length} roles` : '—'} />
        <InfoCard label="Products" value={data.products?.length ? `${data.products.length} items` : '—'} />
        <InfoCard label="Marketing" value={data.marketingChannels?.length ? `${data.marketingChannels.length} channels` : '—'} />
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function HRView({ employees }) {
  if (!employees?.length) return <EmptySheet label="HR Costs" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Role</th>
            <th className="px-3 py-2 text-left">Department</th>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-right">Count</th>
            <th className="px-3 py-2 text-right">Monthly Salary</th>
            <th className="px-3 py-2 text-right">Monthly Total</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30">
              <td className="px-3 py-1.5">{i + 1}</td>
              <td className="px-3 py-1.5 font-medium">{emp.name}</td>
              <td className="px-3 py-1.5">{emp.department}</td>
              <td className="px-3 py-1.5 capitalize">{emp.category?.replace('_', ' ')}</td>
              <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{emp.count || 1}</td>
              <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{fmt(emp.monthlySalary)}</td>
              <td className="px-3 py-1.5 text-right bg-blue-50">{fmt((emp.count || 1) * emp.monthlySalary)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[#D9E2F3] font-bold">
            <td colSpan={4} className="px-3 py-2">TOTAL</td>
            <td className="px-3 py-2 text-right">{employees.reduce((s, e) => s + (e.count || 1), 0)}</td>
            <td className="px-3 py-2 text-right">—</td>
            <td className="px-3 py-2 text-right">{fmt(employees.reduce((s, e) => s + (e.count || 1) * e.monthlySalary, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RateCardView({ employees }) {
  if (!employees?.length) return <EmptySheet label="Rate Card" />;
  const wd = 26, hd = 8, eff = 0.8;
  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-slate-500 mb-2">Working Days: {wd} | Hours/Day: {hd} | Efficiency: {eff * 100}%</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-3 py-2 text-left">Role</th>
            <th className="px-3 py-2 text-right">Monthly Salary</th>
            <th className="px-3 py-2 text-right">Cost/Hour</th>
            <th className="px-3 py-2 text-right">Cost/Day</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => {
            const hourly = emp.monthlySalary / (wd * hd * eff);
            return (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-1.5">{emp.name}</td>
                <td className="px-3 py-1.5 text-right bg-[#D6E4F0]">{fmt(emp.monthlySalary)}</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(hourly)}</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(hourly * hd)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MarketingView({ channels }) {
  if (!channels?.length) return <EmptySheet label="Marketing Costs" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-3 py-2 text-left">Channel</th>
            <th className="px-3 py-2 text-right">Monthly Budget</th>
            <th className="px-3 py-2 text-right">Leads</th>
            <th className="px-3 py-2 text-right">Conv %</th>
            <th className="px-3 py-2 text-right">Customers</th>
            <th className="px-3 py-2 text-right">CAC</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((ch, i) => {
            const customers = ch.expectedLeads * ch.conversionRate;
            const cac = customers > 0 ? ch.monthlyBudget / customers : 0;
            return (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-1.5">{ch.channel}</td>
                <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{fmt(ch.monthlyBudget)}</td>
                <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{ch.expectedLeads}</td>
                <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{(ch.conversionRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{Math.round(customers)}</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(cac)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ManufacturingView({ products }) {
  if (!products?.length) return <EmptySheet label="Manufacturing Costs" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-left">Group</th>
            <th className="px-3 py-2 text-right">Total Cost</th>
            <th className="px-3 py-2 text-right">Margin</th>
            <th className="px-3 py-2 text-right">Sale Price</th>
            <th className="px-3 py-2 text-right">Monthly Vol</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => {
            const totalCost = (p.costElements || []).reduce((s, e) => s + e.cost, 0);
            const sp = totalCost / (1 - (p.targetMargin || 0.35));
            return (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-1.5 font-medium">{p.name}</td>
                <td className="px-3 py-1.5">{p.group}</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(totalCost)}</td>
                <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{((p.targetMargin || 0.35) * 100).toFixed(0)}%</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(sp)}</td>
                <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{p.monthlyVolume || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdminView({ expenses }) {
  if (!expenses?.length) return <EmptySheet label="Admin Expenses" />;
  const categories = [...new Set(expenses.map(e => e.category))];
  return (
    <div className="space-y-3">
      {categories.map(cat => (
        <div key={cat}>
          <h4 className="text-xs font-semibold text-navy bg-[#D9E2F3] px-3 py-1.5 rounded-t">{cat}</h4>
          <table className="w-full text-xs">
            <tbody>
              {expenses.filter(e => e.category === cat).map((exp, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-1.5">{exp.item}</td>
                  <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50 w-32">{fmt(exp.monthlyAmount)}</td>
                  <td className="px-3 py-1.5 text-right bg-blue-50 w-32">{fmt(exp.monthlyAmount * 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function CapexView({ items }) {
  if (!items?.length) return <EmptySheet label="CAPEX" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-left">Asset</th>
            <th className="px-3 py-2 text-right">Cost</th>
            <th className="px-3 py-2 text-right">Life (Yrs)</th>
            <th className="px-3 py-2 text-right">Annual Dep</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="px-3 py-1.5">{item.category}</td>
              <td className="px-3 py-1.5">{item.item}</td>
              <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{fmt(item.cost)}</td>
              <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{item.usefulLife}</td>
              <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(item.cost / item.usefulLife)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinanceView({ loans }) {
  if (!loans?.length) return <EmptySheet label="Finance Costs" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-3 py-2 text-left">Loan</th>
            <th className="px-3 py-2 text-right">Principal</th>
            <th className="px-3 py-2 text-right">Rate</th>
            <th className="px-3 py-2 text-right">Tenure (Mo)</th>
            <th className="px-3 py-2 text-right">Monthly EMI</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan, i) => {
            const r = loan.interestRate / 12;
            const n = loan.tenureMonths;
            const emi = r > 0 ? (loan.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loan.principal / n;
            return (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-1.5">{loan.name}</td>
                <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{fmt(loan.principal)}</td>
                <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{(loan.interestRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right text-blue-600 bg-green-50">{n}</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(emi)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductMixView({ products }) {
  if (!products?.length) return <EmptySheet label="Product Market Mix" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-center">Active</th>
            <th className="px-3 py-2 text-right">Cost/Unit</th>
            <th className="px-3 py-2 text-right">Sale Price</th>
            <th className="px-3 py-2 text-right">Margin</th>
            <th className="px-3 py-2 text-right">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => {
            const cost = (p.costElements || []).reduce((s, e) => s + e.cost, 0);
            const sp = cost / (1 - (p.targetMargin || 0.35));
            return (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-1.5 font-medium">{p.name}</td>
                <td className="px-3 py-1.5 text-center text-green-600 font-bold">YES</td>
                <td className="px-3 py-1.5 text-right">{fmt(cost)}</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(sp)}</td>
                <td className="px-3 py-1.5 text-right">{((p.targetMargin || 0.35) * 100).toFixed(0)}%</td>
                <td className="px-3 py-1.5 text-right bg-blue-50">{fmt(sp - cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LTVView({ params }) {
  const aov = params?.avgOrderValue || 0;
  const freq = params?.purchaseFrequency || 12;
  const ret = params?.retentionRate || 0.7;
  const margin = params?.grossMargin || 0.4;
  const lifespan = ret < 1 ? 1 / (1 - ret) : 10;
  const ltv = aov * freq * lifespan * margin;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-navy">Customer LTV Parameters</h4>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <InfoCard label="Avg Order Value" value={fmt(aov)} />
        <InfoCard label="Purchase Freq/Year" value={freq.toString()} />
        <InfoCard label="Retention Rate" value={`${(ret * 100).toFixed(0)}%`} />
        <InfoCard label="Gross Margin" value={`${(margin * 100).toFixed(0)}%`} />
      </div>
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="text-xs text-green-600">Simple LTV</div>
        <div className="text-xl font-bold text-green-800">{fmt(ltv)}</div>
        <div className="text-xs text-green-600 mt-1">Lifespan: {lifespan.toFixed(1)} years</div>
      </div>
    </div>
  );
}

function ScenarioView({ scenarios }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-3 py-2 text-left">Metric</th>
            <th className="px-3 py-2 text-center text-green-300">Best</th>
            <th className="px-3 py-2 text-center">Base</th>
            <th className="px-3 py-2 text-center text-red-300">Worst</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="px-3 py-1.5">Revenue Multiplier</td>
            <td className="px-3 py-1.5 text-center bg-green-50">{scenarios?.best?.revenueMultiplier || 1.2}x</td>
            <td className="px-3 py-1.5 text-center">{scenarios?.base?.revenueMultiplier || 1.0}x</td>
            <td className="px-3 py-1.5 text-center bg-red-50">{scenarios?.worst?.revenueMultiplier || 0.7}x</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="px-3 py-1.5">Cost Multiplier</td>
            <td className="px-3 py-1.5 text-center bg-green-50">{scenarios?.best?.costMultiplier || 0.9}x</td>
            <td className="px-3 py-1.5 text-center">{scenarios?.base?.costMultiplier || 1.0}x</td>
            <td className="px-3 py-1.5 text-center bg-red-50">{scenarios?.worst?.costMultiplier || 1.15}x</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EmptySheet({ label }) {
  return (
    <div className="flex items-center justify-center h-32 text-slate-400 text-xs">
      No {label} data yet. Complete the chat to populate this sheet.
    </div>
  );
}

/** Format number as INR */
function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '\u20B90';
  return '\u20B9' + Math.round(n).toLocaleString('en-IN');
}
