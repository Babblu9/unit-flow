'use client';

import React, { useState } from 'react';
import { useUnitEconomics } from '@/context/UnitEconomicsContext';
import { BarChart3, TrendingUp, Wallet, Users, Target, Layers, Pencil, ChevronDown, ChevronRight, Lightbulb, ArrowDownCircle } from 'lucide-react';

/* ════════════════════════════════════════════════════════
   Theme constants — mirrors Fina AI's semantic color system
   ════════════════════════════════════════════════════════ */
const T = {
  navy:      '#1B2A4A',
  navyLight: '#2D4373',
  teal:      '#0F766E',
  tealLight: '#14B8A6',
  green:     '#15803D',
  greenLight:'#22C55E',
  red:       '#E53935',
  gold:      '#D97706',
  purple:    '#7C3AED',
  // Backgrounds
  bg0: '#F8FAFC', bg1: '#FFFFFF', bg2: '#F1F5F9', bg3: '#E2E8F0',
  // Text
  t0: '#0F172A', t1: '#334155', t2: '#64748B', t3: '#94A3B8',
  // Excel
  header: '#1F4E79', input: '#C6EFCE', formula: '#BDD7EE', link: '#D6E4F0', total: '#D9E2F3',
  // Shadows
  card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
  cardHover: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
};

/* ════════════════════════════════════════════════════════
   Sheet tab config — group by Input vs Output
   ════════════════════════════════════════════════════════ */
const INPUT_SHEETS = [
  'Instructions & Guide',
  '1. HR Costs', '1.1 Rate Card',
  '2. Marketing Costs',
  '3. Manufacturing Costs',
  '3A. Geo Purchase Costs', '3B. Geo Sale Prices', '3C. Geo Selector',
  '3D. Admin & Other Expenses', '3E. Capital Expenses (CAPEX)', '3F. Finance Costs',
];
const OUTPUT_SHEETS = [
  '4. Product Market Mix', '5. Customer LTV Analysis',
  '6. Target Profit Calculator', '7. Cash Flow',
  '8. KPI Dashboard', '9. Scenario Analysis',
  '10. Smart Suggestions',
];

export default function SheetViewer() {
  const {
    activeSheet, setActiveSheet, flashingSheet, SHEET_NAMES,
    businessInfo, employees, marketingChannels, products,
    adminExpenses, capexItems, loans, ltvParams, scenarios,
    cities, selectedCity, profitTargets, costSuggestions, completion,
    // Update helpers for inline editing
    updateEmployee, updateProduct, updateProductCostElement,
    updateMarketingChannel, updateAdminExpense, updateCapexItem,
    updateLoan, updateLtvParam, updateCityProduct, updateProfitTarget,
  } = useUnitEconomics();

  const data = { businessInfo, employees, marketingChannels, products, adminExpenses, capexItems, loans, ltvParams, scenarios, cities, selectedCity, profitTargets, costSuggestions };
  const updaters = { updateEmployee, updateProduct, updateProductCostElement, updateMarketingChannel, updateAdminExpense, updateCapexItem, updateLoan, updateLtvParam, updateCityProduct, updateProfitTarget };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-page)]">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 bg-white border-b border-[var(--border)] excel-scroll flex-shrink-0">
        {/* Input group label */}
        <span className="flex-shrink-0 px-2 py-0.5 mr-1 rounded text-[9px] font-bold uppercase tracking-[0.06em]"
          style={{ background: `${T.navy}0D`, color: T.navy }}>
          Inputs
        </span>
        {INPUT_SHEETS.map(name => (
          <TabBtn key={name} name={name} active={activeSheet === name} flash={flashingSheet === name} onClick={() => setActiveSheet(name)} />
        ))}
        {/* Divider */}
        <div className="flex-shrink-0 w-px h-5 bg-[var(--border)] mx-1" />
        {/* Output group label */}
        <span className="flex-shrink-0 px-2 py-0.5 mr-1 rounded text-[9px] font-bold uppercase tracking-[0.06em]"
          style={{ background: `${T.teal}0D`, color: T.teal }}>
          Outputs
        </span>
        {OUTPUT_SHEETS.map(name => (
          <TabBtn key={name} name={name} active={activeSheet === name} flash={flashingSheet === name} onClick={() => setActiveSheet(name)} color={T.teal} />
        ))}
      </div>

      {/* ── Sheet content ── */}
      <div className="flex-1 overflow-auto p-5 excel-scroll">
        {completion < 60 ? <EmptyState /> : <SheetContent sheetName={activeSheet} data={data} updaters={updaters} />}
      </div>
    </div>
  );
}

/* ── Tab button ── */
function TabBtn({ name, active, flash, onClick, color = T.navy }) {
  const short = name.replace(/^\d+[A-F]?\.\s*/, '').replace('(CAPEX)', 'CAPEX');
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap transition-all"
      style={{
        background: active ? color : flash ? '#F0FDF4' : 'transparent',
        color: active ? '#fff' : flash ? T.green : T.t2,
        boxShadow: active ? `0 2px 6px ${color}35` : 'none',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = T.bg2; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = flash ? '#F0FDF4' : 'transparent'; } }}
    >
      {short}
    </button>
  );
}

/* ── Empty state ── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `linear-gradient(135deg, ${T.navy}10, ${T.navy}05)` }}>
        <BarChart3 className="w-7 h-7" style={{ color: T.navy, opacity: 0.3 }} />
      </div>
      <p className="text-[14px] font-semibold" style={{ color: T.t1 }}>Your model will appear here</p>
      <p className="text-[12px] mt-1" style={{ color: T.t3 }}>Complete the chat to see your 17-sheet Unit Economics model</p>
    </div>
  );
}

/* ── Sheet router ── */
function SheetContent({ sheetName, data, updaters }) {
  const views = {
    'Instructions & Guide': () => <InstructionsView data={data} />,
    '1. HR Costs': () => <HRView employees={data.employees} onUpdate={updaters.updateEmployee} />,
    '1.1 Rate Card': () => <RateCardView employees={data.employees} />,
    '2. Marketing Costs': () => <MarketingView channels={data.marketingChannels} onUpdate={updaters.updateMarketingChannel} />,
    '3. Manufacturing Costs': () => <ManufacturingView products={data.products} onUpdate={updaters.updateProduct} />,
    '3A. Geo Purchase Costs': () => <GeoPurchaseView cities={data.cities} onUpdate={updaters.updateCityProduct} />,
    '3B. Geo Sale Prices': () => <GeoSalePriceView cities={data.cities} onUpdate={updaters.updateCityProduct} />,
    '3C. Geo Selector': () => <GeoSelectorView cities={data.cities} selectedCity={data.selectedCity} products={data.products} />,
    '3D. Admin & Other Expenses': () => <AdminView expenses={data.adminExpenses} onUpdate={updaters.updateAdminExpense} />,
    '3E. Capital Expenses (CAPEX)': () => <CapexView items={data.capexItems} onUpdate={updaters.updateCapexItem} />,
    '3F. Finance Costs': () => <FinanceView loans={data.loans} onUpdate={updaters.updateLoan} />,
    '4. Product Market Mix': () => <ProductMixView products={data.products} employees={data.employees} adminExpenses={data.adminExpenses} capexItems={data.capexItems} onUpdateCostElement={updaters.updateProductCostElement} />,
    '5. Customer LTV Analysis': () => <LTVView params={data.ltvParams} onUpdate={updaters.updateLtvParam} />,
    '6. Target Profit Calculator': () => <TargetProfitView products={data.products} profitTargets={data.profitTargets} employees={data.employees} adminExpenses={data.adminExpenses} onUpdateProfitTarget={updaters.updateProfitTarget} />,
    '7. Cash Flow': () => <CashFlowView products={data.products} employees={data.employees} marketingChannels={data.marketingChannels} adminExpenses={data.adminExpenses} loans={data.loans} />,
    '8. KPI Dashboard': () => <KPIDashboardView products={data.products} employees={data.employees} marketingChannels={data.marketingChannels} ltvParams={data.ltvParams} />,
    '9. Scenario Analysis': () => <ScenarioView scenarios={data.scenarios} />,
    '10. Smart Suggestions': () => <CostSuggestionsView suggestions={data.costSuggestions} profitTargets={data.profitTargets} />,
  };
  const View = views[sheetName];
  return View ? <View /> : <EmptySheet label={sheetName} />;
}

/* ════════════════════════════════════════════════════════
   Shared components
   ════════════════════════════════════════════════════════ */

/** Section card with left accent bar */
function SectionCard({ title, subtitle, accentColor = T.navy, children }) {
  return (
    <div className="rounded-xl overflow-hidden slide-up" style={{ background: T.bg1, boxShadow: T.card, border: `1px solid ${T.bg3}` }}>
      <div className="relative px-5 py-3 border-b" style={{ borderColor: T.bg3 }}>
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r" style={{ background: `linear-gradient(180deg, ${accentColor}, ${accentColor}80)` }} />
        <h3 className="text-[14px] font-bold tracking-[-0.02em]" style={{ color: T.t0 }}>{title}</h3>
        {subtitle && <p className="text-[11px] mt-0.5" style={{ color: T.t3 }}>{subtitle}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/** Data table with header and hover rows */
function DataTable({ headers, children, footer }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${T.bg3}` }}>
      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ background: `linear-gradient(135deg, ${T.header}, ${T.header}E0)` }}>
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2.5 text-white font-semibold text-[11px] uppercase tracking-[0.04em] ${h.align === 'right' ? 'text-right' : 'text-left'}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

/** Stat card */
function StatCard({ label, value, accent, icon: Icon }) {
  return (
    <div className="rounded-lg p-3.5 hover-lift" style={{ background: T.bg1, boxShadow: T.card, border: `1px solid ${T.bg3}` }}>
      <div className="relative" style={{ paddingLeft: Icon ? '0' : '0' }}>
        {accent && <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded" style={{ background: accent }} />}
        <div className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: T.t3, paddingLeft: accent ? '8px' : '0' }}>{label}</div>
        <div className="text-[15px] font-bold font-num mt-0.5" style={{ color: T.t0, paddingLeft: accent ? '8px' : '0' }}>{value}</div>
      </div>
    </div>
  );
}

/** Table cell helpers */
function InputCell({ children, align = 'right' }) {
  return <td className={`px-3 py-2 font-num text-${align}`} style={{ background: `${T.input}40`, color: '#0000FF' }}>{children}</td>;
}

/** Editable input cell — click to edit, blur/Enter to save */
function EditableInputCell({ value, onChange, format = 'number', align = 'right', suffix = '' }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const displayValue = format === 'percent'
    ? `${(Number(value) * 100).toFixed(1)}%`
    : format === 'currency'
      ? fmt(value)
      : (suffix ? `${value}${suffix}` : value);

  const handleClick = () => {
    if (!onChange) return;
    const raw = format === 'percent' ? (Number(value) * 100).toFixed(1) : String(value ?? '');
    setEditValue(raw);
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    let parsed = parseFloat(editValue);
    if (isNaN(parsed)) return; // discard invalid input
    if (format === 'percent') parsed = parsed / 100;
    if (parsed !== Number(value)) {
      onChange(parsed);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setEditing(false); }
  };

  if (editing) {
    return (
      <td className={`px-1 py-1 text-${align}`} style={{ background: `${T.input}60` }}>
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full px-2 py-1 text-[12px] font-num text-right rounded border outline-none"
          style={{ borderColor: T.navy, background: '#fff', color: '#0000FF' }}
        />
      </td>
    );
  }

  return (
    <td
      className={`px-3 py-2 font-num text-${align} group relative`}
      style={{ background: `${T.input}40`, color: '#0000FF', cursor: onChange ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      {displayValue}
      {onChange && (
        <Pencil className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: T.navy }} />
      )}
    </td>
  );
}
/** Variant of EditableInputCell that supports colSpan prop for cost element rows */
function EditableInlineCell({ value, onChange, format = 'number', colSpan = 1 }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const displayValue = format === 'percent'
    ? `${(Number(value) * 100).toFixed(1)}%`
    : format === 'currency'
      ? fmt(value)
      : value;

  const handleClick = () => {
    if (!onChange) return;
    const raw = format === 'percent' ? (Number(value) * 100).toFixed(1) : String(value ?? '');
    setEditValue(raw);
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    let parsed = parseFloat(editValue);
    if (isNaN(parsed)) return;
    if (format === 'percent') parsed = parsed / 100;
    if (parsed !== Number(value)) onChange(parsed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setEditing(false); }
  };

  if (editing) {
    return (
      <td colSpan={colSpan} className="px-1 py-1 text-right" style={{ background: `${T.input}60` }}>
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full px-2 py-1 text-[12px] font-num text-right rounded border outline-none"
          style={{ borderColor: T.navy, background: '#fff', color: '#0000FF' }}
        />
      </td>
    );
  }

  return (
    <td
      colSpan={colSpan}
      className="px-3 py-1.5 font-num text-right text-[11px] group relative"
      style={{ background: `${T.input}30`, color: '#0000FF', cursor: onChange ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      {displayValue}
      {onChange && (
        <Pencil className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: T.navy }} />
      )}
    </td>
  );
}
function FormulaCell({ children, align = 'right' }) {
  return <td className={`px-3 py-2 font-num text-${align}`} style={{ background: `${T.formula}40`, color: T.t0 }}>{children}</td>;
}
function LinkCell({ children, align = 'right' }) {
  return <td className={`px-3 py-2 font-num text-${align}`} style={{ background: `${T.link}60`, color: T.t0 }}>{children}</td>;
}
function PlainCell({ children, align = 'left', bold = false }) {
  return <td className={`px-3 py-2 text-${align} ${bold ? 'font-semibold' : ''}`} style={{ color: T.t1 }}>{children}</td>;
}

function EmptySheet({ label }) {
  return (
    <div className="flex items-center justify-center h-32 text-[12px]" style={{ color: T.t3 }}>
      No {label} data yet. Complete the chat to populate this sheet.
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Sheet views
   ════════════════════════════════════════════════════════ */

function InstructionsView({ data }) {
  const info = data.businessInfo || {};
  const stats = [
    { label: 'Company', value: info.companyName || '\u2014' },
    { label: 'Stage', value: info.businessStage || '\u2014' },
    { label: 'City', value: info.city || '\u2014' },
    { label: 'Team', value: data.employees?.length ? `${data.employees.length} roles` : '\u2014' },
    { label: 'Products', value: data.products?.length ? `${data.products.length} items` : '\u2014' },
    { label: 'Marketing', value: data.marketingChannels?.length ? `${data.marketingChannels.length} channels` : '\u2014' },
  ];
  const legend = [
    { bg: T.input, label: 'Input cells (editable)', textColor: '#0000FF' },
    { bg: T.formula, label: 'Formula cells (auto-calculated)', textColor: T.t0 },
    { bg: T.header, label: 'Headers', textColor: '#fff' },
    { bg: T.link, label: 'Cross-sheet linked cells', textColor: T.t0 },
  ];
  return (
    <div className="space-y-5">
      <SectionCard title={`${info.companyName || 'Your Company'} \u2014 Unit Flow by OnEasy`} subtitle="17-sheet financial model" accentColor={T.navy}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {stats.map((s, i) => <StatCard key={i} label={s.label} value={s.value} />)}
        </div>
      </SectionCard>
      <SectionCard title="Color Coding Legend" subtitle="How to read your Excel model" accentColor={T.gold}>
        <div className="grid grid-cols-2 gap-2.5">
          {legend.map((l, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-8 h-5 rounded flex-shrink-0" style={{ background: l.bg, border: `1px solid ${T.bg3}` }} />
              <span className="text-[11px]" style={{ color: l.textColor === '#fff' ? T.t1 : l.textColor }}>{l.label}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function HRView({ employees, onUpdate }) {
  if (!employees?.length) return <EmptySheet label="HR Costs" />;
  const headers = [
    { label: '#' }, { label: 'Role' }, { label: 'Department' }, { label: 'Category' },
    { label: 'Count', align: 'right' }, { label: 'Monthly Salary', align: 'right' }, { label: 'Monthly Total', align: 'right' },
  ];
  const totalCount = employees.reduce((s, e) => s + (e.count || 1), 0);
  const totalCost = employees.reduce((s, e) => s + (e.count || 1) * e.monthlySalary, 0);
  return (
    <SectionCard title="HR Costs" subtitle={`${employees.length} roles, ${totalCount} people`} accentColor={T.purple}>
      <DataTable headers={headers} footer={
        <tr style={{ background: T.total }}>
          <td colSpan={4} className="px-3 py-2.5 text-[12px] font-bold" style={{ color: T.t0 }}>TOTAL</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{totalCount}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{'\u2014'}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{fmt(totalCost)}</td>
        </tr>
      }>
        {employees.map((emp, i) => (
          <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
            <PlainCell>{i + 1}</PlainCell>
            <PlainCell bold>{emp.name}</PlainCell>
            <PlainCell>{emp.department}</PlainCell>
            <PlainCell>{(emp.category || '').replace('_', ' ')}</PlainCell>
            <EditableInputCell value={emp.count || 1} onChange={onUpdate ? (v) => onUpdate(i, 'count', v) : null} />
            <EditableInputCell value={emp.monthlySalary} format="currency" onChange={onUpdate ? (v) => onUpdate(i, 'monthlySalary', v) : null} />
            <FormulaCell>{fmt((emp.count || 1) * emp.monthlySalary)}</FormulaCell>
          </tr>
        ))}
      </DataTable>
    </SectionCard>
  );
}

function RateCardView({ employees }) {
  if (!employees?.length) return <EmptySheet label="Rate Card" />;
  const wd = 26, hd = 8, eff = 0.8;
  const headers = [
    { label: 'Role' }, { label: 'Monthly Salary', align: 'right' },
    { label: 'Cost/Hour', align: 'right' }, { label: 'Cost/Day', align: 'right' },
  ];
  return (
    <SectionCard title="Rate Card" subtitle={`Working Days: ${wd} | Hours/Day: ${hd} | Efficiency: ${eff * 100}%`} accentColor={T.teal}>
      <DataTable headers={headers}>
        {employees.map((emp, i) => {
          const hourly = emp.monthlySalary / (wd * hd * eff);
          return (
            <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
              <PlainCell bold>{emp.name}</PlainCell>
              <LinkCell>{fmt(emp.monthlySalary)}</LinkCell>
              <FormulaCell>{fmt(hourly)}</FormulaCell>
              <FormulaCell>{fmt(hourly * hd)}</FormulaCell>
            </tr>
          );
        })}
      </DataTable>
    </SectionCard>
  );
}

function MarketingView({ channels, onUpdate }) {
  if (!channels?.length) return <EmptySheet label="Marketing Costs" />;
  const headers = [
    { label: 'Channel' }, { label: 'Monthly Budget', align: 'right' }, { label: 'Leads', align: 'right' },
    { label: 'Conv %', align: 'right' }, { label: 'Customers', align: 'right' }, { label: 'CAC', align: 'right' },
  ];
  const totalBudget = channels.reduce((s, c) => s + c.monthlyBudget, 0);
  const totalLeads = channels.reduce((s, c) => s + c.expectedLeads, 0);
  const totalCust = channels.reduce((s, c) => s + c.expectedLeads * c.conversionRate, 0);
  return (
    <SectionCard title="Marketing Costs" subtitle={`${channels.length} channels \u2014 AI generated`} accentColor={T.red}>
      <DataTable headers={headers} footer={
        <tr style={{ background: T.total }}>
          <td className="px-3 py-2.5 font-bold text-[12px]" style={{ color: T.t0 }}>TOTAL</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{fmt(totalBudget)}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{totalLeads}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{'\u2014'}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{Math.round(totalCust)}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{'\u2014'}</td>
        </tr>
      }>
        {channels.map((ch, i) => {
          const cust = ch.expectedLeads * ch.conversionRate;
          const cac = cust > 0 ? ch.monthlyBudget / cust : 0;
          return (
            <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
              <PlainCell bold>{ch.channel}</PlainCell>
              <EditableInputCell value={ch.monthlyBudget} format="currency" onChange={onUpdate ? (v) => onUpdate(i, 'monthlyBudget', v) : null} />
              <EditableInputCell value={ch.expectedLeads} onChange={onUpdate ? (v) => onUpdate(i, 'expectedLeads', v) : null} />
              <EditableInputCell value={ch.conversionRate} format="percent" onChange={onUpdate ? (v) => onUpdate(i, 'conversionRate', v) : null} />
              <FormulaCell>{Math.round(cust)}</FormulaCell>
              <FormulaCell>{fmt(cac)}</FormulaCell>
            </tr>
          );
        })}
      </DataTable>
    </SectionCard>
  );
}

function ManufacturingView({ products, onUpdate }) {
  if (!products?.length) return <EmptySheet label="Manufacturing Costs" />;
  const headers = [
    { label: 'Product' }, { label: 'Group' }, { label: 'Total Cost', align: 'right' },
    { label: 'Margin', align: 'right' }, { label: 'Sale Price', align: 'right' }, { label: 'Monthly Vol', align: 'right' },
  ];
  return (
    <SectionCard title="Manufacturing Costs" subtitle="Bill of materials & cost breakdown" accentColor={T.gold}>
      <DataTable headers={headers}>
        {products.map((p, i) => {
          const tc = (p.costElements || []).reduce((s, e) => s + e.cost, 0);
          const sp = tc / (1 - (p.targetMargin || 0.35));
          return (
            <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
              <PlainCell bold>{p.name}</PlainCell>
              <PlainCell>{p.group}</PlainCell>
              <FormulaCell>{fmt(tc)}</FormulaCell>
              <EditableInputCell value={p.targetMargin || 0.35} format="percent" onChange={onUpdate ? (v) => onUpdate(i, 'targetMargin', v) : null} />
              <FormulaCell>{fmt(sp)}</FormulaCell>
              <EditableInputCell value={p.monthlyVolume || 0} onChange={onUpdate ? (v) => onUpdate(i, 'monthlyVolume', v) : null} />
            </tr>
          );
        })}
      </DataTable>
    </SectionCard>
  );
}

function GeoPurchaseView({ cities, onUpdate }) {
  if (!cities?.length) return <EmptySheet label="Geo Purchase Costs" />;
  const pNames = cities[0]?.products?.map(p => p.productName) || [];
  const headers = [{ label: 'City' }, ...pNames.map(n => ({ label: n, align: 'right' }))];
  return (
    <SectionCard title="Geo Purchase Costs" subtitle="Purchase costs by city" accentColor={T.gold}>
      <DataTable headers={headers}>
        {cities.map((city, i) => (
          <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
            <PlainCell bold>{city.cityName}</PlainCell>
            {(city.products || []).map((p, j) => (
              <EditableInputCell key={j} value={p.purchaseCost} format="currency" onChange={onUpdate ? (v) => onUpdate(i, j, 'purchaseCost', v) : null} />
            ))}
          </tr>
        ))}
      </DataTable>
    </SectionCard>
  );
}

function GeoSalePriceView({ cities, onUpdate }) {
  if (!cities?.length) return <EmptySheet label="Geo Sale Prices" />;
  const pNames = cities[0]?.products?.map(p => p.productName) || [];
  const headers = [{ label: 'City' }, ...pNames.map(n => ({ label: n, align: 'right' }))];
  return (
    <SectionCard title="Geo Sale Prices" subtitle="Margin-first pricing by city" accentColor={T.green}>
      <DataTable headers={headers}>
        {cities.map((city, i) => (
          <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
            <PlainCell bold>{city.cityName}</PlainCell>
            {(city.products || []).map((p, j) => (
              <EditableInputCell key={j} value={p.salePrice} format="currency" onChange={onUpdate ? (v) => onUpdate(i, j, 'salePrice', v) : null} />
            ))}
          </tr>
        ))}
      </DataTable>
    </SectionCard>
  );
}

function GeoSelectorView({ cities, selectedCity, products }) {
  if (!cities?.length) return <EmptySheet label="Geo Selector" />;
  const activeCity = cities.find(c => c.cityName === selectedCity) || cities[0];
  const headers = [
    { label: 'Product' }, { label: 'Purchase Cost', align: 'right' }, { label: 'Sale Price', align: 'right' },
    { label: 'Margin', align: 'right' }, { label: 'Monthly Revenue', align: 'right' },
  ];
  return (
    <SectionCard title="Geo Selector" subtitle={`Selected city: ${activeCity?.cityName || '\u2014'}`} accentColor={T.tealLight}>
      <DataTable headers={headers}>
        {(activeCity?.products || []).map((cp, i) => {
          const margin = cp.salePrice > 0 ? (cp.salePrice - cp.purchaseCost) / cp.salePrice : 0;
          const vol = products?.find(p => p.name === cp.productName)?.monthlyVolume || 0;
          return (
            <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
              <PlainCell bold>{cp.productName}</PlainCell>
              <LinkCell>{fmt(cp.purchaseCost)}</LinkCell>
              <LinkCell>{fmt(cp.salePrice)}</LinkCell>
              <FormulaCell>{(margin * 100).toFixed(1)}%</FormulaCell>
              <FormulaCell>{fmt(cp.salePrice * vol)}</FormulaCell>
            </tr>
          );
        })}
      </DataTable>
    </SectionCard>
  );
}

function AdminView({ expenses, onUpdate }) {
  if (!expenses?.length) return <EmptySheet label="Admin Expenses" />;
  const categories = [...new Set(expenses.map(e => e.category))];
  const total = expenses.reduce((s, e) => s + e.monthlyAmount, 0);
  return (
    <SectionCard title="Admin & Other Expenses" subtitle={`${expenses.length} items across ${categories.length} categories`} accentColor={T.red}>
      <div className="space-y-3">
        {categories.map(cat => {
          const catExpenses = expenses.filter(e => e.category === cat);
          return (
            <div key={cat}>
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] rounded-t" style={{ background: T.total, color: T.navy }}>
                {cat}
              </div>
              <div className="rounded-b" style={{ border: `1px solid ${T.bg3}`, borderTop: 'none' }}>
                <table className="w-full text-[12px]">
                  <tbody>
                    {catExpenses.map((exp, i) => {
                      const globalIdx = expenses.indexOf(exp);
                      return (
                        <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
                          <PlainCell>{exp.item}</PlainCell>
                          <EditableInputCell value={exp.monthlyAmount} format="currency" onChange={onUpdate ? (v) => onUpdate(globalIdx, 'monthlyAmount', v) : null} />
                          <FormulaCell>{fmt(exp.monthlyAmount * 12)}</FormulaCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        <div className="flex justify-between items-center px-4 py-2.5 rounded-lg font-bold text-[12px]" style={{ background: T.total, color: T.t0 }}>
          <span>TOTAL ADMIN EXPENSES</span>
          <span className="font-num">{fmt(total)}/mo</span>
        </div>
      </div>
    </SectionCard>
  );
}

function CapexView({ items, onUpdate }) {
  if (!items?.length) return <EmptySheet label="CAPEX" />;
  const headers = [
    { label: 'Category' }, { label: 'Asset' }, { label: 'Cost', align: 'right' },
    { label: 'Life (Yrs)', align: 'right' }, { label: 'Annual Dep', align: 'right' }, { label: 'Monthly Dep', align: 'right' },
  ];
  const totalCost = items.reduce((s, it) => s + it.cost, 0);
  const totalAnnDep = items.reduce((s, it) => s + it.cost / it.usefulLife, 0);
  return (
    <SectionCard title="Capital Expenses (CAPEX)" subtitle="Assets & depreciation" accentColor={T.purple}>
      <DataTable headers={headers} footer={
        <tr style={{ background: T.total }}>
          <td colSpan={2} className="px-3 py-2.5 font-bold text-[12px]" style={{ color: T.t0 }}>TOTAL</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{fmt(totalCost)}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{'\u2014'}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{fmt(totalAnnDep)}</td>
          <td className="px-3 py-2.5 text-right font-bold font-num" style={{ color: T.t0 }}>{fmt(totalAnnDep / 12)}</td>
        </tr>
      }>
        {items.map((it, i) => (
          <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
            <PlainCell>{it.category}</PlainCell>
            <PlainCell bold>{it.item}</PlainCell>
            <EditableInputCell value={it.cost} format="currency" onChange={onUpdate ? (v) => onUpdate(i, 'cost', v) : null} />
            <EditableInputCell value={it.usefulLife} onChange={onUpdate ? (v) => onUpdate(i, 'usefulLife', v) : null} />
            <FormulaCell>{fmt(it.cost / it.usefulLife)}</FormulaCell>
            <FormulaCell>{fmt(it.cost / it.usefulLife / 12)}</FormulaCell>
          </tr>
        ))}
      </DataTable>
    </SectionCard>
  );
}

function FinanceView({ loans, onUpdate }) {
  if (!loans?.length) return <EmptySheet label="Finance Costs" />;
  const headers = [
    { label: 'Loan' }, { label: 'Principal', align: 'right' }, { label: 'Rate', align: 'right' },
    { label: 'Tenure (Mo)', align: 'right' }, { label: 'Monthly EMI', align: 'right' },
  ];
  return (
    <SectionCard title="Finance Costs" subtitle="Loans & EMI calculations" accentColor={T.gold}>
      <DataTable headers={headers}>
        {loans.map((loan, i) => {
          const r = loan.interestRate / 12;
          const n = loan.tenureMonths;
          const emi = r > 0 ? (loan.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loan.principal / n;
          return (
            <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
              <PlainCell bold>{loan.name}</PlainCell>
              <EditableInputCell value={loan.principal} format="currency" onChange={onUpdate ? (v) => onUpdate(i, 'principal', v) : null} />
              <EditableInputCell value={loan.interestRate} format="percent" onChange={onUpdate ? (v) => onUpdate(i, 'interestRate', v) : null} />
              <EditableInputCell value={n} onChange={onUpdate ? (v) => onUpdate(i, 'tenureMonths', v) : null} />
              <FormulaCell>{fmt(emi)}</FormulaCell>
            </tr>
          );
        })}
      </DataTable>
    </SectionCard>
  );
}

function ProductMixView({ products, employees, adminExpenses, capexItems, onUpdateCostElement }) {
  if (!products?.length) return <EmptySheet label="Product Market Mix" />;
  const [expandedProducts, setExpandedProducts] = useState({});

  const toggleExpand = (i) => {
    setExpandedProducts(prev => ({ ...prev, [i]: !prev[i] }));
  };

  // Calculate overhead allocation per product
  const totalHR = (employees || []).reduce((s, e) => s + (e.count || 1) * e.monthlySalary, 0);
  const totalAdmin = (adminExpenses || []).reduce((s, e) => s + e.monthlyAmount, 0);
  const totalDepreciation = (capexItems || []).reduce((s, it) => s + (it.cost / (it.usefulLife || 1) / 12), 0);
  const totalFixedCosts = totalHR + totalAdmin + totalDepreciation;
  const totalMonthlyVolume = products.reduce((s, p) => s + (p.monthlyVolume || 0), 0);
  const activeProducts = products.length;

  // Category labels for display
  const categoryLabels = {
    raw_material: 'Raw Material',
    direct_labor: 'Direct Labor',
    packaging: 'Packaging',
    logistics: 'Logistics',
    processing: 'Processing',
    overhead: 'Overhead',
    other: 'Other',
  };

  const headers = [
    { label: '' }, { label: 'Product' }, { label: 'Active' },
    { label: 'Direct Cost', align: 'right' }, { label: 'Overhead/Unit', align: 'right' },
    { label: 'Full Cost', align: 'right' }, { label: 'Sale Price', align: 'right' },
    { label: 'Margin', align: 'right' }, { label: 'Contribution', align: 'right' },
  ];

  return (
    <SectionCard title="Product Market Mix" subtitle="Full cost build-up with overhead allocation & break-even" accentColor={T.teal}>
      {/* Overhead allocation summary */}
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        <StatCard label="Monthly HR Costs" value={fmt(totalHR)} accent={T.purple} />
        <StatCard label="Monthly Admin" value={fmt(totalAdmin)} accent={T.red} />
        <StatCard label="Monthly Depreciation" value={fmt(totalDepreciation)} accent={T.gold} />
        <StatCard label="Total Fixed Costs" value={fmt(totalFixedCosts)} accent={T.navy} />
      </div>
      <div className="text-[10px] mb-3 px-1 py-1.5 rounded" style={{ background: `${T.teal}08`, color: T.teal, border: `1px solid ${T.teal}20` }}>
        Fixed costs allocated per unit = Total Fixed Costs / Total Monthly Volume ({totalMonthlyVolume} units) = {fmt(totalMonthlyVolume > 0 ? totalFixedCosts / totalMonthlyVolume : 0)}/unit
      </div>

      <DataTable headers={headers}>
        {products.map((p, i) => {
          const directCost = (p.costElements || []).reduce((s, e) => s + e.cost, 0);
          const vol = p.monthlyVolume || 0;
          // Allocate overhead proportionally by volume share
          const volumeShare = totalMonthlyVolume > 0 ? vol / totalMonthlyVolume : (1 / activeProducts);
          const overheadPerUnit = vol > 0 ? (totalFixedCosts * volumeShare) / vol : 0;
          const fullCost = directCost + overheadPerUnit;
          const sp = directCost / (1 - (p.targetMargin || 0.35));
          const contrib = sp - directCost;
          const isExpanded = expandedProducts[i];

          return (
            <React.Fragment key={i}>
              {/* Main product row */}
              <tr className="sheet-row border-b cursor-pointer" style={{ borderColor: T.bg2 }}
                  onClick={() => toggleExpand(i)}>
                <td className="px-2 py-2 w-6">
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5" style={{ color: T.teal }} />
                    : <ChevronRight className="w-3.5 h-3.5" style={{ color: T.t3 }} />}
                </td>
                <PlainCell bold>{p.name}</PlainCell>
                <td className="px-3 py-2 text-center font-bold text-[12px]" style={{ color: T.green }}>YES</td>
                <FormulaCell>{fmt(directCost)}</FormulaCell>
                <FormulaCell>{fmt(overheadPerUnit)}</FormulaCell>
                <FormulaCell>{fmt(fullCost)}</FormulaCell>
                <FormulaCell>{fmt(sp)}</FormulaCell>
                <PlainCell align="right">{((p.targetMargin || 0.35) * 100).toFixed(0)}%</PlainCell>
                <FormulaCell>{fmt(contrib)}</FormulaCell>
              </tr>
              {/* Expanded cost breakdown */}
              {isExpanded && (
                <>
                  {/* Cost element header */}
                  <tr style={{ background: `${T.teal}08` }}>
                    <td></td>
                    <td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: T.teal }}>
                      Cost Element
                    </td>
                    <td className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: T.teal }}>
                      Category
                    </td>
                    <td colSpan={2} className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: T.teal }}>
                      Cost/Unit
                    </td>
                    <td colSpan={3} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: T.teal }}>
                      Estimation Basis
                    </td>
                  </tr>
                  {(p.costElements || []).map((ce, j) => (
                    <tr key={`ce-${i}-${j}`} style={{ background: `${T.teal}04`, borderBottom: `1px solid ${T.bg2}` }}>
                      <td></td>
                      <td colSpan={2} className="px-3 py-1.5 text-[11px]" style={{ color: T.t1, paddingLeft: '2rem' }}>
                        {ce.name}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[10px]" style={{ color: T.t2 }}>
                        <span className="px-1.5 py-0.5 rounded" style={{ background: `${T.teal}10`, color: T.teal }}>
                          {categoryLabels[ce.category] || ce.category || 'Other'}
                        </span>
                      </td>
                      {onUpdateCostElement ? (
                        <EditableInlineCell colSpan={2} value={ce.cost} format="currency" onChange={(v) => onUpdateCostElement(i, j, 'cost', v)} />
                      ) : (
                        <td colSpan={2} className="px-3 py-1.5 text-right font-num text-[11px]" style={{ color: '#0000FF', background: `${T.input}30` }}>
                          {fmt(ce.cost)}
                        </td>
                      )}
                      <td colSpan={3} className="px-3 py-1.5 text-[10px] italic" style={{ color: T.t3 }}>
                        {ce.notes || '\u2014'}
                      </td>
                    </tr>
                  ))}
                  {/* Subtotal row */}
                  <tr style={{ background: `${T.teal}12`, borderBottom: `2px solid ${T.teal}30` }}>
                    <td></td>
                    <td colSpan={2} className="px-3 py-1.5 text-[11px] font-bold" style={{ color: T.teal, paddingLeft: '2rem' }}>
                      Direct Cost Subtotal
                    </td>
                    <td></td>
                    <td colSpan={2} className="px-3 py-1.5 text-right font-num font-bold text-[11px]" style={{ color: T.teal }}>
                      {fmt(directCost)}
                    </td>
                    <td colSpan={3} className="px-3 py-1.5 text-[10px]" style={{ color: T.t3 }}>
                      Sum of {(p.costElements || []).length} cost elements
                    </td>
                  </tr>
                  {/* Overhead allocation row */}
                  <tr style={{ background: `${T.gold}08`, borderBottom: `2px solid ${T.bg3}` }}>
                    <td></td>
                    <td colSpan={2} className="px-3 py-1.5 text-[11px] font-bold" style={{ color: T.gold, paddingLeft: '2rem' }}>
                      + Allocated Overhead/Unit
                    </td>
                    <td className="px-3 py-1.5 text-right text-[10px]" style={{ color: T.t2 }}>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: `${T.gold}10`, color: T.gold }}>Fixed Costs</span>
                    </td>
                    <td colSpan={2} className="px-3 py-1.5 text-right font-num font-bold text-[11px]" style={{ color: T.gold }}>
                      {fmt(overheadPerUnit)}
                    </td>
                    <td colSpan={3} className="px-3 py-1.5 text-[10px] italic" style={{ color: T.t3 }}>
                      {fmt(totalFixedCosts)} \u00D7 {(volumeShare * 100).toFixed(1)}% / {vol} units
                    </td>
                  </tr>
                </>
              )}
            </React.Fragment>
          );
        })}
      </DataTable>
      <p className="text-[10px] mt-2" style={{ color: T.t3 }}>
        Click any product row to expand its full cost breakdown. Direct costs come from the Manufacturing sheet; overhead is allocated proportionally by volume.
      </p>
    </SectionCard>
  );
}

function LTVView({ params, onUpdate }) {
  const aov = params?.avgOrderValue || 0;
  const freq = params?.purchaseFrequency || 12;
  const ret = params?.retentionRate || 0.7;
  const margin = params?.grossMargin || 0.4;
  const discount = params?.discountRate || 0.1;
  const lifespan = ret < 1 ? 1 / (1 - ret) : 10;
  const simpleLTV = aov * freq * lifespan * margin;
  let dcfLTV = 0;
  for (let m = 0; m < 24; m++) {
    const retention = Math.pow(ret, m / 12);
    const revenue = aov * (freq / 12) * retention * margin;
    dcfLTV += revenue / Math.pow(1 + discount / 12, m);
  }

  const ltvInputs = [
    { label: 'Avg Order Value', field: 'avgOrderValue', value: aov, format: 'currency' },
    { label: 'Purchase Freq/Year', field: 'purchaseFrequency', value: freq, format: 'number' },
    { label: 'Retention Rate', field: 'retentionRate', value: ret, format: 'percent' },
    { label: 'Gross Margin', field: 'grossMargin', value: margin, format: 'percent' },
    { label: 'Discount Rate', field: 'discountRate', value: discount, format: 'percent' },
  ];

  return (
    <SectionCard title="Customer LTV Analysis" subtitle="Simple LTV + 24-month DCF cohort" accentColor={T.green}>
      <div className="space-y-4">
        {/* Editable input parameters */}
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${T.bg3}` }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: `linear-gradient(135deg, ${T.header}, ${T.header}E0)` }}>
                <th className="px-3 py-2.5 text-white font-semibold text-[11px] uppercase tracking-[0.04em] text-left">Parameter</th>
                <th className="px-3 py-2.5 text-white font-semibold text-[11px] uppercase tracking-[0.04em] text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {ltvInputs.map((inp, i) => (
                <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
                  <PlainCell bold>{inp.label}</PlainCell>
                  <EditableInputCell value={inp.value} format={inp.format} onChange={onUpdate ? (v) => onUpdate(inp.field, v) : null} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${T.green}08, ${T.bg1} 40%)`, border: `1px solid ${T.green}25`, boxShadow: T.card }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: T.green }}>Simple LTV</div>
            <div className="text-xl font-bold font-num mt-1" style={{ color: T.t0 }}>{fmt(simpleLTV)}</div>
            <div className="text-[10px] mt-1" style={{ color: T.green }}>Lifespan: {lifespan.toFixed(1)} years</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${T.teal}08, ${T.bg1} 40%)`, border: `1px solid ${T.teal}25`, boxShadow: T.card }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: T.teal }}>24-Month DCF LTV</div>
            <div className="text-xl font-bold font-num mt-1" style={{ color: T.t0 }}>{fmt(dcfLTV)}</div>
            <div className="text-[10px] mt-1" style={{ color: T.teal }}>Discount rate: {(discount * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function TargetProfitView({ products, profitTargets, employees, adminExpenses, onUpdateProfitTarget }) {
  if (!products?.length) return <EmptySheet label="Target Profit Calculator" />;
  const totalHR = (employees || []).reduce((s, e) => s + (e.count || 1) * e.monthlySalary, 0);
  const totalAdmin = (adminExpenses || []).reduce((s, e) => s + e.monthlyAmount, 0);
  const totalFixed = totalHR + totalAdmin;
  const targetProfit = profitTargets?.targetMonthlyProfit || 0;
  const rationale = profitTargets?.rationale || '';
  const reqContrib = totalFixed + targetProfit;
  const headers = [
    { label: 'Product' }, { label: 'Contribution/Unit', align: 'right' },
    { label: 'Required Units/Mo', align: 'right' }, { label: 'Required Revenue/Mo', align: 'right' },
  ];
  return (
    <SectionCard title="Target Profit Calculator" subtitle="Set your desired profit and reverse-engineer sales targets" accentColor={T.gold}>
      {/* Editable profit target */}
      <div className="rounded-lg p-4 mb-4" style={{ background: `linear-gradient(135deg, ${T.green}08, ${T.bg1} 40%)`, border: `1px solid ${T.green}25`, boxShadow: T.card }}>
        <div className="flex items-center gap-3 mb-2">
          <Target className="w-5 h-5" style={{ color: T.green }} />
          <div className="text-[13px] font-bold" style={{ color: T.t0 }}>Desired Monthly Profit</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${T.bg3}` }}>
              <table className="w-full text-[12px]">
                <tbody>
                  <tr className="sheet-row">
                    <td className="px-3 py-2 font-semibold" style={{ color: T.t1, width: '200px' }}>Target Monthly Profit</td>
                    <EditableInputCell value={targetProfit} format="currency" onChange={onUpdateProfitTarget ? (v) => onUpdateProfitTarget('targetMonthlyProfit', v) : null} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {rationale && (
          <div className="text-[10px] mt-2 px-1 italic" style={{ color: T.t2 }}>
            {rationale}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <StatCard label="Total Fixed Costs" value={fmt(totalFixed)} accent={T.red} />
        <StatCard label="Target Profit" value={fmt(targetProfit)} accent={T.green} />
        <StatCard label="Required Contribution" value={fmt(reqContrib)} accent={T.navy} />
      </div>
      <DataTable headers={headers}>
        {products.map((p, i) => {
          const cost = (p.costElements || []).reduce((s, e) => s + e.cost, 0);
          const sp = cost / (1 - (p.targetMargin || 0.35));
          const contrib = sp - cost;
          const share = 1 / products.length;
          const unitsNeeded = contrib > 0 ? Math.ceil((reqContrib * share) / contrib) : 0;
          return (
            <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
              <PlainCell bold>{p.name}</PlainCell>
              <LinkCell>{fmt(contrib)}</LinkCell>
              <FormulaCell>{unitsNeeded}</FormulaCell>
              <FormulaCell>{fmt(unitsNeeded * sp)}</FormulaCell>
            </tr>
          );
        })}
      </DataTable>
      <p className="text-[10px] mt-2" style={{ color: T.t3 }}>* Revenue split equally across products. Excel uses customizable mix ratios. Edit the profit target above to see required units recalculate instantly.</p>
    </SectionCard>
  );
}

function CashFlowView({ products, employees, marketingChannels, adminExpenses, loans }) {
  if (!products?.length) return <EmptySheet label="Cash Flow" />;
  const monthlyRev = products.reduce((s, p) => {
    const c = (p.costElements || []).reduce((s2, e) => s2 + e.cost, 0);
    return s + (c / (1 - (p.targetMargin || 0.35))) * (p.monthlyVolume || 0);
  }, 0);
  const monthlyCOGS = products.reduce((s, p) => {
    const c = (p.costElements || []).reduce((s2, e) => s2 + e.cost, 0);
    return s + c * (p.monthlyVolume || 0);
  }, 0);
  const monthlyHR = (employees || []).reduce((s, e) => s + (e.count || 1) * e.monthlySalary, 0);
  const monthlyMkt = (marketingChannels || []).reduce((s, c) => s + c.monthlyBudget, 0);
  const monthlyAdmin = (adminExpenses || []).reduce((s, e) => s + e.monthlyAmount, 0);
  const monthlyEMI = (loans || []).reduce((s, l) => {
    const r = l.interestRate / 12;
    const n = l.tenureMonths;
    return s + (r > 0 ? (l.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : l.principal / n);
  }, 0);
  const g = 0.05;
  const months = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];
  const rows = [
    { label: 'Revenue', base: monthlyRev, grows: true },
    { label: 'COGS', base: monthlyCOGS, grows: true },
    { label: 'Gross Profit', base: monthlyRev - monthlyCOGS, grows: true, isTotal: true },
    { label: 'HR Costs', base: monthlyHR, grows: false },
    { label: 'Marketing', base: monthlyMkt, grows: false },
    { label: 'Admin', base: monthlyAdmin, grows: false },
    { label: 'EMI', base: monthlyEMI, grows: false },
  ];
  const totalExp = monthlyHR + monthlyMkt + monthlyAdmin + monthlyEMI;

  return (
    <SectionCard title="12-Month Cash Flow Projection" subtitle={`Assumes ${(g * 100).toFixed(0)}% monthly revenue growth`} accentColor={T.teal}>
      <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${T.bg3}` }}>
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ background: `linear-gradient(135deg, ${T.header}, ${T.header}E0)` }}>
              <th className="px-3 py-2.5 text-left text-white font-semibold text-[10px] uppercase tracking-[0.04em] sticky left-0 z-10" style={{ background: T.header }}>Line Item</th>
              {months.map(m => <th key={m} className="px-2 py-2.5 text-right text-white font-semibold text-[10px] min-w-[72px]">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={`border-b ${row.isTotal ? '' : 'sheet-row'}`} style={{ borderColor: T.bg2, background: row.isTotal ? T.total : 'transparent' }}>
                <td className={`px-3 py-2 sticky left-0 z-10 ${row.isTotal ? 'font-bold' : 'font-medium'}`} style={{ background: row.isTotal ? T.total : T.bg1, color: T.t1 }}>{row.label}</td>
                {months.map((_, mi) => {
                  const val = row.base * (row.grows ? Math.pow(1 + g, mi) : 1);
                  return <td key={mi} className="px-2 py-2 text-right font-num" style={{ background: row.isTotal ? T.total : `${T.formula}30`, color: T.t1 }}>{fmtShort(val)}</td>;
                })}
              </tr>
            ))}
            {/* Net Cash Flow */}
            <tr style={{ background: `linear-gradient(135deg, ${T.header}, ${T.header}E0)` }}>
              <td className="px-3 py-2.5 sticky left-0 z-10 text-white font-bold text-[11px]" style={{ background: T.header }}>Net Cash Flow</td>
              {months.map((_, mi) => {
                const rev = monthlyRev * Math.pow(1 + g, mi);
                const cogs = monthlyCOGS * Math.pow(1 + g, mi);
                const net = rev - cogs - totalExp;
                return <td key={mi} className="px-2 py-2.5 text-right font-bold font-num" style={{ color: net < 0 ? '#FCA5A5' : '#86EFAC' }}>{fmtShort(net)}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function KPIDashboardView({ products, employees, marketingChannels, ltvParams }) {
  if (!products?.length) return <EmptySheet label="KPI Dashboard" />;
  const monthlyRev = products.reduce((s, p) => {
    const c = (p.costElements || []).reduce((s2, e) => s2 + e.cost, 0);
    return s + (c / (1 - (p.targetMargin || 0.35))) * (p.monthlyVolume || 0);
  }, 0);
  const monthlyCOGS = products.reduce((s, p) => {
    const c = (p.costElements || []).reduce((s2, e) => s2 + e.cost, 0);
    return s + c * (p.monthlyVolume || 0);
  }, 0);
  const gp = monthlyRev - monthlyCOGS;
  const gm = monthlyRev > 0 ? gp / monthlyRev : 0;
  const monthlyHR = (employees || []).reduce((s, e) => s + (e.count || 1) * e.monthlySalary, 0);
  const monthlyMkt = (marketingChannels || []).reduce((s, c) => s + c.monthlyBudget, 0);
  const totalLeads = (marketingChannels || []).reduce((s, c) => s + c.expectedLeads, 0);
  const totalCust = (marketingChannels || []).reduce((s, c) => s + c.expectedLeads * c.conversionRate, 0);
  const cac = totalCust > 0 ? monthlyMkt / totalCust : 0;
  const avgMargin = products.length > 0 ? products.reduce((s, p) => s + (p.targetMargin || 0.35), 0) / products.length : 0;
  const aov = ltvParams?.avgOrderValue || (monthlyRev / Math.max(totalCust, 1));
  const ret = ltvParams?.retentionRate || 0.7;
  const lifespan = ret < 1 ? 1 / (1 - ret) : 10;
  const simpleLTV = aov * (ltvParams?.purchaseFrequency || 12) * lifespan * (ltvParams?.grossMargin || gm);
  const ltvCac = cac > 0 ? simpleLTV / cac : 0;
  const teamSize = (employees || []).reduce((s, e) => s + (e.count || 1), 0);

  const kpis = [
    { label: 'Monthly Revenue', value: fmt(monthlyRev), accent: T.teal },
    { label: 'Monthly COGS', value: fmt(monthlyCOGS), accent: T.red },
    { label: 'Gross Profit', value: fmt(gp), accent: T.green },
    { label: 'Gross Margin', value: `${(gm * 100).toFixed(1)}%`, accent: T.green },
    { label: 'HR Cost/Revenue', value: monthlyRev > 0 ? `${((monthlyHR / monthlyRev) * 100).toFixed(1)}%` : '\u2014', accent: T.purple },
    { label: 'Monthly Leads', value: totalLeads.toString(), accent: T.teal },
    { label: 'Monthly Customers', value: Math.round(totalCust).toString(), accent: T.teal },
    { label: 'CAC', value: fmt(cac), accent: T.gold },
    { label: 'Avg Order Value', value: fmt(aov), accent: T.teal },
    { label: 'Simple LTV', value: fmt(simpleLTV), accent: T.green },
    { label: 'LTV/CAC Ratio', value: ltvCac > 0 ? `${ltvCac.toFixed(1)}x` : '\u2014', accent: ltvCac >= 3 ? T.green : T.red },
    { label: 'Avg Product Margin', value: `${(avgMargin * 100).toFixed(1)}%`, accent: T.teal },
    { label: 'Team Size', value: teamSize.toString(), accent: T.purple },
  ];

  return (
    <SectionCard title="KPI Dashboard" subtitle="13 live KPIs" accentColor={T.navy}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        {kpis.map((kpi, i) => (
          <StatCard key={i} label={kpi.label} value={kpi.value} accent={kpi.accent} />
        ))}
      </div>
      <p className="text-[10px] mt-3" style={{ color: T.t3 }}>* All KPIs in the Excel file use live cross-sheet formulas.</p>
    </SectionCard>
  );
}

function ScenarioView({ scenarios }) {
  const headers = [
    { label: 'Metric' },
    { label: 'Best Case', align: 'right' },
    { label: 'Base Case', align: 'right' },
    { label: 'Worst Case', align: 'right' },
  ];
  const metrics = [
    { label: 'Revenue Multiplier', best: scenarios?.best?.revenueMultiplier || 1.2, base: scenarios?.base?.revenueMultiplier || 1.0, worst: scenarios?.worst?.revenueMultiplier || 0.7 },
    { label: 'Cost Multiplier', best: scenarios?.best?.costMultiplier || 0.9, base: scenarios?.base?.costMultiplier || 1.0, worst: scenarios?.worst?.costMultiplier || 1.15 },
  ];
  return (
    <SectionCard title="Scenario Analysis" subtitle="Best / Base / Worst case with cross-sheet refs" accentColor={T.navy}>
      <DataTable headers={headers}>
        {metrics.map((m, i) => (
          <tr key={i} className="sheet-row border-b" style={{ borderColor: T.bg2 }}>
            <PlainCell bold>{m.label}</PlainCell>
            <td className="px-3 py-2 text-right font-num font-semibold" style={{ background: `${T.green}10`, color: T.green }}>{m.best}x</td>
            <td className="px-3 py-2 text-right font-num" style={{ color: T.t1 }}>{m.base}x</td>
            <td className="px-3 py-2 text-right font-num font-semibold" style={{ background: `${T.red}10`, color: T.red }}>{m.worst}x</td>
          </tr>
        ))}
      </DataTable>
    </SectionCard>
  );
}

function CostSuggestionsView({ suggestions, profitTargets }) {
  if (!suggestions?.length) {
    return (
      <SectionCard title="Smart Suggestions" subtitle="AI-powered cost optimization recommendations" accentColor={T.green}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${T.green}10` }}>
            <Lightbulb className="w-6 h-6" style={{ color: T.green, opacity: 0.4 }} />
          </div>
          <p className="text-[13px] font-semibold" style={{ color: T.t1 }}>No suggestions yet</p>
          <p className="text-[11px] mt-1" style={{ color: T.t3 }}>Cost optimization suggestions will appear here after your model is generated.</p>
        </div>
      </SectionCard>
    );
  }

  const totalSavings = suggestions.reduce((s, sg) => s + (sg.monthlySavings || 0), 0);
  const targetProfit = profitTargets?.targetMonthlyProfit || 0;

  const impactColors = {
    high: T.green,
    medium: T.gold,
    low: T.t3,
  };

  const categoryIcons = {
    rent: '\uD83C\uDFE2',
    hiring: '\uD83D\uDC65',
    marketing: '\uD83D\uDCE3',
    operations: '\u2699\uFE0F',
    technology: '\uD83D\uDCBB',
    finance: '\uD83D\uDCB0',
    general: '\uD83D\uDCA1',
  };

  return (
    <SectionCard title="Smart Suggestions" subtitle={`${suggestions.length} cost optimization recommendations`} accentColor={T.green}>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${T.green}08, ${T.bg1} 40%)`, border: `1px solid ${T.green}25`, boxShadow: T.card }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: T.green }}>Potential Monthly Savings</div>
          <div className="text-xl font-bold font-num mt-1" style={{ color: T.t0 }}>{fmt(totalSavings)}</div>
          <div className="text-[10px] mt-1" style={{ color: T.green }}>{fmt(totalSavings * 12)}/year</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${T.teal}08, ${T.bg1} 40%)`, border: `1px solid ${T.teal}25`, boxShadow: T.card }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: T.teal }}>Target Profit</div>
          <div className="text-xl font-bold font-num mt-1" style={{ color: T.t0 }}>{fmt(targetProfit)}</div>
          <div className="text-[10px] mt-1" style={{ color: T.teal }}>{profitTargets?.rationale || 'Set in Target Profit Calculator'}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${T.gold}08, ${T.bg1} 40%)`, border: `1px solid ${T.gold}25`, boxShadow: T.card }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: T.gold }}>Savings as % of Profit Target</div>
          <div className="text-xl font-bold font-num mt-1" style={{ color: T.t0 }}>
            {targetProfit > 0 ? `${((totalSavings / targetProfit) * 100).toFixed(0)}%` : '\u2014'}
          </div>
          <div className="text-[10px] mt-1" style={{ color: T.gold }}>
            {targetProfit > 0 && totalSavings > 0 ? 'of your profit target can be covered by savings' : 'Set a profit target to see impact'}
          </div>
        </div>
      </div>

      {/* Suggestion cards */}
      <div className="space-y-3">
        {suggestions.map((sg, i) => {
          const impactColor = impactColors[sg.impact] || T.t3;
          const icon = categoryIcons[sg.category] || '\uD83D\uDCA1';
          return (
            <div key={sg.id || i} className="rounded-lg overflow-hidden hover-lift transition-all"
                 style={{ border: `1px solid ${T.bg3}`, boxShadow: T.card }}>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: T.bg1 }}>
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold" style={{ color: T.t0 }}>{sg.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.04em]"
                          style={{ background: `${impactColor}15`, color: impactColor }}>
                      {sg.impact} impact
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: T.t2 }}>{sg.description}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-[10px] font-bold uppercase" style={{ color: T.green }}>Save</div>
                  <div className="text-[15px] font-bold font-num" style={{ color: T.green }}>{fmt(sg.monthlySavings)}</div>
                  <div className="text-[9px]" style={{ color: T.t3 }}>/month</div>
                </div>
              </div>
              {/* Cost comparison bar */}
              <div className="px-4 py-2.5 flex items-center gap-4" style={{ background: T.bg2 }}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold" style={{ color: T.red }}>Current:</span>
                  <span className="text-[12px] font-bold font-num" style={{ color: T.red }}>{fmt(sg.currentCost)}</span>
                </div>
                <ArrowDownCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold" style={{ color: T.green }}>Suggested:</span>
                  <span className="text-[12px] font-bold font-num" style={{ color: T.green }}>{fmt(sg.suggestedCost)}</span>
                </div>
                {sg.tradeoffs && (
                  <div className="flex-1 text-right">
                    <span className="text-[9px] italic" style={{ color: T.t3 }}>Tradeoff: {sg.tradeoffs}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] mt-3" style={{ color: T.t3 }}>
        These suggestions are AI-generated based on your business model and industry benchmarks. Discuss specific suggestions in the chat to apply them to your model.
      </p>
    </SectionCard>
  );
}

/* ════════════════════════════════════════════════════════
   Formatters
   ════════════════════════════════════════════════════════ */

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '\u20B90';
  return '\u20B9' + Math.round(n).toLocaleString('en-IN');
}

function fmtShort(n) {
  if (n === undefined || n === null || isNaN(n)) return '\u20B90';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}\u20B9${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}\u20B9${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}\u20B9${(abs / 1000).toFixed(1)}K`;
  return `${sign}\u20B9${Math.round(abs)}`;
}
