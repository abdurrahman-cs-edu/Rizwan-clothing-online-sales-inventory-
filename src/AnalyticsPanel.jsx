// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LabelList, Cell
} from 'recharts';
import { supabase } from './supabaseClient';

// Charts & Reports tab.
// One date filter at the top, then a choice of report: Sales, Designs, Sizes,
// Fabric, Delivery, Customers. Read-only: it reads the view public.design_lines,
// the sales table (delivery fields only), designs (fabric) and postex_city_codes.
// Online sales only; Khata is never included. Nothing is written.

const C = {
  text2: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  brand: '#5b4cf0',
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  magenta: '#e87ba4',
  gray: '#b8b6ae',
};
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SIZE_COLORS = { S: C.blue, M: C.orange, L: C.aqua, XL: C.yellow, XXL: C.magenta };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const REPORTS = [
  ['sales', 'Sales'],
  ['profit', 'Profit'],
  ['designs', 'Designs'],
  ['sizes', 'Sizes'],
  ['fabric', 'Fabric'],
  ['delivery', 'Delivery & Payment'],
  ['customers', 'Customers'],
];

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const pkr = (n) => `PKR ${fmt(n)}`;
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const shortDate = (s) => { const d = parseDay(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const titleCase = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const nameKey = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
const kTick = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);

async function fetchAll(table, columns, filter) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  for (;;) {
    let q = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ---------- UI pieces ----------
function Card({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, note }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl sm:text-2xl font-black text-gray-900 mt-2 break-words">{value}</p>
      {note && <p className="text-xs text-gray-500 mt-1">{note}</p>}
    </div>
  );
}

function Tip({ active, payload, lines }) {
  if (!active || !payload || !payload.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-gray-900 text-white rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-bold mb-0.5">{r.tip || r.name || r.label}</p>
      {lines(r).map(([k, v]) => <p key={k} className="text-gray-300">{k}: <span className="font-semibold text-white">{v}</span></p>)}
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-gray-400 py-6 text-center">{children}</p>;
}

// Horizontal ranked bars (one series). Height grows with the number of rows.
function RankBars({ rows, valueKey, color = C.brand, tipLines, labelFmt = fmt, nameWidth = 140 }) {
  if (!rows.length) return <Empty>No data in this period.</Empty>;
  return (
    <div style={{ width: '100%', height: Math.max(160, rows.length * 34) }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, left: 4, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }} stroke={C.axis} tickLine={false} allowDecimals={false} tickFormatter={kTick} />
          <YAxis type="category" dataKey="name" tick={{ fill: C.text2, fontSize: 12 }} width={nameWidth} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: '#f3f2ee' }} content={<Tip lines={tipLines} />} />
          <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            <LabelList dataKey={valueKey} position="right" formatter={labelFmt} style={{ fill: C.text2, fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SimpleTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-xs font-semibold text-gray-500 border-b border-gray-100">
            {columns.map(([label, , align]) => <th key={label} className={`py-2 pr-3 ${align === 'right' ? 'text-right' : ''}`}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-50">
              {columns.map(([label, render, align]) => (
                <td key={label} className={`py-2 pr-3 ${align === 'right' ? 'text-right' : ''}`}>{render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SegmentBar({ parts, colors, unit }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <Empty>No data in this period.</Empty>;
  return (
    <div>
      <div className="flex w-full h-8 rounded-md overflow-hidden gap-[2px] bg-white">
        {parts.filter(p => p.value > 0).map(p => (
          <div key={p.name} title={`${p.name}: ${fmt(p.value)} ${unit} (${Math.round((p.value / total) * 100)}%)`}
            style={{ width: `${(p.value / total) * 100}%`, background: colors[p.name] }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {parts.map(p => (
          <div key={p.name} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: colors[p.name] }} />
            <span className="font-semibold text-gray-900">{p.name}</span>
            <span className="text-gray-500">{fmt(p.value)} ({Math.round((p.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Main ----------
export default function AnalyticsPanel() {
  const [lines, setLines] = useState([]);
  const [orders, setOrders] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [pxCodes, setPxCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [grain, setGrain] = useState('week');
  const [report, setReport] = useState('sales');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [saleLines, orderRows, designsRes, pxRes] = await Promise.all([
          fetchAll('design_lines',
            'source_id, design_name, raw_name, customer, unit_price, qty, amount, payment_method, sale_date, qty_s, qty_m, qty_l, qty_xl, qty_xxl',
            (q) => q.eq('source', 'sale')),
          fetchAll('sales', 'id, dateStr, paymentMethod, cod_sub_option, local_rider_sub_option, city, orderCode, cod_paid, totalAmount, totalQty'),
          supabase.from('designs').select('name, fabric, cost, is_active'),
          supabase.from('postex_city_codes').select('prefix, city'),
        ]);
        if (designsRes.error) throw designsRes.error;
        if (!alive) return;
        setLines(saleLines);
        setOrders(orderRows);
        setDesigns(designsRes.data || []);
        const px = {};
        (pxRes.data || []).forEach(r => { px[String(r.prefix || '').trim().toUpperCase()] = r.city; });
        setPxCodes(px);
      } catch (e) {
        console.error('Reports load error:', e);
        if (alive) setError('Could not load report data. Please refresh the page.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const allDates = useMemo(() => lines.map(l => l.sale_date).filter(Boolean).sort(), [lines]);
  const firstDate = allDates[0] || '';
  const lastDate = allDates[allDates.length - 1] || '';

  const setPreset = (preset) => {
    const today = new Date();
    if (preset === 'all') { setFrom(''); setTo(''); }
    if (preset === 'month') { setFrom(toKey(new Date(today.getFullYear(), today.getMonth(), 1))); setTo(toKey(today)); }
    if (preset === '30') { const st = new Date(today); st.setDate(st.getDate() - 29); setFrom(toKey(st)); setTo(toKey(today)); }
  };
  const inRange = (d) => !!d && (!from || d >= from) && (!to || d <= to);

  const r = useMemo(() => {
    const L = lines.filter(l => inRange(l.sale_date));
    const O = orders.filter(o => inRange(o.dateStr));
    const fabricOf = {};
    designs.forEach(d => { if (d.fabric && d.fabric.trim()) fabricOf[nameKey(d.name)] = titleCase(d.fabric); });

    // Orders summary (from lines, so it matches the design report)
    const orderMap = new Map();
    let revenue = 0;
    let suits = 0;
    L.forEach(l => {
      const amount = Number(l.amount) || 0;
      revenue += amount;
      suits += Number(l.qty) || 0;
      const o = orderMap.get(l.source_id) || { amount: 0, payment: l.payment_method, date: l.sale_date, customer: l.customer };
      o.amount += amount;
      orderMap.set(l.source_id, o);
    });

    // Trend
    const bucketKey = (dateStr) => {
      const d = parseDay(dateStr);
      if (grain === 'day') return dateStr;
      if (grain === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return toKey(monday);
    };
    const tMap = new Map();
    orderMap.forEach(o => {
      const k = bucketKey(o.date);
      const t = tMap.get(k) || { key: k, revenue: 0, orders: 0 };
      t.revenue += o.amount; t.orders += 1; tMap.set(k, t);
    });
    const trend = Array.from(tMap.values()).sort((a, b) => a.key.localeCompare(b.key)).map(t => {
      if (grain === 'month') { const [y, m] = t.key.split('-').map(Number); const lbl = `${MONTHS[m - 1]} ${y}`; return { ...t, label: lbl, tip: lbl }; }
      return { ...t, label: shortDate(t.key), tip: grain === 'week' ? `Week of ${shortDate(t.key)}` : shortDate(t.key) };
    });

    // Weekday
    const dow = DAYS.map(day => ({ name: day, revenue: 0, orders: 0 }));
    orderMap.forEach(o => { const i = (parseDay(o.date).getDay() + 6) % 7; dow[i].revenue += o.amount; dow[i].orders += 1; });

    // Designs
    const dMap = new Map();
    L.forEach(l => {
      const name = l.design_name || `${l.raw_name} (unlinked)`;
      const d = dMap.get(name) || { name, qty: 0, amount: 0 };
      d.qty += Number(l.qty) || 0; d.amount += Number(l.amount) || 0; dMap.set(name, d);
    });
    const designList = Array.from(dMap.values());
    const topDesigns = designList.slice().sort((a, b) => b.qty - a.qty).slice(0, 10);
    const topRevenue = designList.slice().sort((a, b) => b.amount - a.amount).slice(0, 10);
    const slow = designs.filter(d => d.is_active).map(d => {
      const x = dMap.get(d.name);
      return { name: d.name, qty: x ? x.qty : 0, amount: x ? x.amount : 0 };
    }).sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name)).slice(0, 10);

    // Sizes (revenue per size = size qty × that line's unit price)
    const sz = Object.fromEntries(SIZES.map(k => [k, { name: k, qty: 0, amount: 0 }]));
    L.forEach(l => {
      const price = Number(l.unit_price) || 0;
      [['S', l.qty_s], ['M', l.qty_m], ['L', l.qty_l], ['XL', l.qty_xl], ['XXL', l.qty_xxl]].forEach(([k, v]) => {
        const q = Number(v) || 0; sz[k].qty += q; sz[k].amount += q * price;
      });
    });
    const sizes = SIZES.map(k => sz[k]);
    const sizeTotal = sizes.reduce((a, x) => a + x.qty, 0);
    // Top designs per size (most sold design for each size)
    const sizeTop = SIZES.map(k => {
      const col = { S: 'qty_s', M: 'qty_m', L: 'qty_l', XL: 'qty_xl', XXL: 'qty_xxl' }[k];
      const m = new Map();
      L.forEach(l => { const q = Number(l[col]) || 0; if (!q) return; const n = l.design_name || l.raw_name; m.set(n, (m.get(n) || 0) + q); });
      const best = Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
      return { size: k, design: best ? best[0] : '-', qty: best ? best[1] : 0 };
    });

    // Fabric
    const fMap = new Map();
    let fabricSuits = 0;
    let noFabricSuits = 0;
    L.forEach(l => {
      const f = fabricOf[nameKey(l.design_name)];
      const q = Number(l.qty) || 0;
      if (!f) { noFabricSuits += q; return; }
      fabricSuits += q;
      const x = fMap.get(f) || { name: f, qty: 0, amount: 0, designs: new Set() };
      x.qty += q; x.amount += Number(l.amount) || 0; x.designs.add(l.design_name); fMap.set(f, x);
    });
    const fabrics = Array.from(fMap.values()).map(x => ({ ...x, designCount: x.designs.size })).sort((a, b) => b.qty - a.qty);

    // Delivery & payment (from sales rows)
    const isCod = (o) => o.paymentMethod === 'Cash on Delivery';
    const pay = [
      { name: 'Advance', value: O.filter(o => !isCod(o)).length },
      { name: 'COD', value: O.filter(isCod).length },
    ];
    const codRows = O.filter(isCod);
    const codStatus = [
      { name: 'Paid', value: codRows.filter(o => (o.cod_paid || 'No') === 'Yes').length },
      { name: 'Unpaid', value: codRows.filter(o => (o.cod_paid || 'No') !== 'Yes').length },
    ];
    const channel = [
      { name: 'PostEx', value: codRows.filter(o => o.cod_sub_option === 'PostEx').length },
      { name: 'D&D', value: codRows.filter(o => o.cod_sub_option === 'Local Rider' && (o.local_rider_sub_option || 'D&D') === 'D&D').length },
      { name: 'Service Delivery', value: codRows.filter(o => o.cod_sub_option === 'Local Rider' && o.local_rider_sub_option === 'Service Delivery').length },
    ];
    const cityRows = (rows, cityOf) => {
      const m = new Map();
      rows.forEach(o => {
        const c = cityOf(o);
        const x = m.get(c) || { name: c, parcels: 0, amount: 0 };
        x.parcels += 1; x.amount += Number(o.totalAmount) || 0; m.set(c, x);
      });
      return Array.from(m.values()).sort((a, b) => b.parcels - a.parcels);
    };
    const riderCities = cityRows(codRows.filter(o => o.cod_sub_option === 'Local Rider'), o => titleCase(o.city) || 'Unknown');
    const postexCities = cityRows(codRows.filter(o => o.cod_sub_option === 'PostEx'), o => {
      const prefix = String(o.orderCode || '').split('-')[0].trim().toUpperCase();
      return titleCase(o.city) || pxCodes[prefix] || 'Unknown';
    });

    // Profit (gross): sale amount - suits x design cost. Uses the CURRENT cost of each design.
    const costOf = {};
    designs.forEach(d => { if (d.cost != null && Number(d.cost) > 0) costOf[nameKey(d.name)] = Number(d.cost); });
    const pMap = new Map();
    let pRevenue = 0;
    let pCost = 0;
    let noCostSuits = 0;
    let noCostAmount = 0;
    L.forEach(l => {
      const q = Number(l.qty) || 0;
      const amount = Number(l.amount) || 0;
      const c = costOf[nameKey(l.design_name)];
      if (c == null) { noCostSuits += q; noCostAmount += amount; return; }
      pRevenue += amount;
      pCost += q * c;
      const x = pMap.get(l.design_name) || { name: l.design_name, qty: 0, amount: 0, cost: 0, unitCost: c };
      x.qty += q; x.amount += amount; x.cost += q * c; pMap.set(l.design_name, x);
    });
    const profitRows = Array.from(pMap.values()).map(x => ({
      ...x,
      profit: x.amount - x.cost,
      margin: x.amount ? ((x.amount - x.cost) / x.amount) * 100 : 0,
      avgPrice: x.qty ? x.amount / x.qty : 0,
    }));
    const mostProfitable = profitRows.slice().sort((a, b) => b.profit - a.profit).slice(0, 10);
    const lossRows = profitRows.filter(x => x.profit < 0).sort((a, b) => a.profit - b.profit);
    const lowMargin = profitRows.filter(x => x.profit >= 0 && x.margin < 15).sort((a, b) => a.margin - b.margin);
    const costedDesigns = designs.filter(d => d.is_active && d.cost != null && Number(d.cost) > 0).length;
    const activeDesigns = designs.filter(d => d.is_active).length;

    // Customers (names as typed; similar spellings are not merged yet)
    const cMap = new Map();
    orderMap.forEach(o => {
      const n = titleCase(o.customer) || 'Unknown';
      const x = cMap.get(n) || { name: n, orders: 0, amount: 0, suits: 0 };
      x.orders += 1; x.amount += o.amount; cMap.set(n, x);
    });
    L.forEach(l => { const x = cMap.get(titleCase(l.customer) || 'Unknown'); if (x) x.suits += Number(l.qty) || 0; });
    const customers = Array.from(cMap.values()).sort((a, b) => b.amount - a.amount);
    const repeat = customers.filter(c => c.orders > 1).length;

    return {
      revenue, suits, orderCount: orderMap.size, aov: orderMap.size ? revenue / orderMap.size : 0,
      trend, dow, topDesigns, topRevenue, slow, sizes, sizeTotal, sizeTop,
      fabrics, fabricSuits, noFabricSuits,
      pay, codStatus, channel, riderCities, postexCities,
      customers: customers.slice(0, 15), customerCount: customers.length, repeat,
      unlinked: L.filter(l => !l.design_name).length,
      pRevenue, pCost, pProfit: pRevenue - pCost, pMargin: pRevenue ? ((pRevenue - pCost) / pRevenue) * 100 : 0,
      profitRows: profitRows.sort((a, b) => b.profit - a.profit), mostProfitable, lossRows, lowMargin,
      noCostSuits, noCostAmount, costedDesigns, activeDesigns,
    };
  }, [lines, orders, designs, pxCodes, from, to, grain]);

  if (loading) return <div className="py-16 text-center text-gray-400">Loading reports...</div>;
  if (error) return <div className="py-16 text-center text-red-600 font-semibold">{error}</div>;

  const axisTick = { fill: C.muted, fontSize: 11 };

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs font-bold text-gray-400 uppercase">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          <span className="text-xs font-bold text-gray-400 uppercase">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div className="flex gap-2">
          {[['all', 'All time'], ['month', 'This month'], ['30', 'Last 30 days']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setPreset(k)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">{label}</button>
          ))}
        </div>
        <p className="text-xs text-gray-500 sm:ml-auto">Online sales only (Khata not included). Data from {firstDate ? shortDate(firstDate) : '-'} to {lastDate ? shortDate(lastDate) : '-'}.</p>
      </div>

      {/* Report chooser */}
      <div className="flex flex-wrap gap-2">
        {REPORTS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setReport(k)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${report === k ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* KPIs (always) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Sales amount" value={pkr(r.revenue)} />
        <Stat label="Orders" value={fmt(r.orderCount)} />
        <Stat label="Suits sold" value={fmt(r.suits)} />
        <Stat label="Average order" value={pkr(r.aov)} />
      </div>

      {report === 'sales' && (
        <>
          <Card title="Sales Trend" subtitle="Sales amount per period. Hover a point to see the number of orders.">
            <div className="flex gap-2 mb-3">
              {[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setGrain(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${grain === k ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{label}</button>
              ))}
            </div>
            {r.trend.length === 0 ? <Empty>No sales in this period.</Empty> : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={r.trend} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} stroke={C.axis} tickLine={false} minTickGap={16} />
                    <YAxis tick={axisTick} stroke={C.axis} tickLine={false} axisLine={false} width={50} tickFormatter={kTick} />
                    <Tooltip cursor={{ stroke: C.axis }} content={<Tip lines={(x) => [['Sales amount', pkr(x.revenue)], ['Orders', fmt(x.orders)]]} />} />
                    <Line type="monotone" dataKey="revenue" stroke={C.brand} strokeWidth={2} isAnimationActive={false}
                      dot={r.trend.length <= 40 ? { r: 4, fill: C.brand, stroke: '#fff', strokeWidth: 2 } : false}
                      activeDot={{ r: 5, fill: C.brand, stroke: '#fff', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card title="Best Days of the Week" subtitle="Total sales amount on each weekday in this period.">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={r.dow} margin={{ top: 16, right: 8, left: 4, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="name" tick={axisTick} stroke={C.axis} tickLine={false} />
                  <YAxis tick={axisTick} stroke={C.axis} tickLine={false} axisLine={false} width={50} tickFormatter={kTick} />
                  <Tooltip cursor={{ fill: '#f3f2ee' }} content={<Tip lines={(x) => [['Sales amount', pkr(x.revenue)], ['Orders', fmt(x.orders)]]} />} />
                  <Bar dataKey="revenue" fill={C.brand} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {report === 'profit' && (
        r.costedDesigns === 0 ? (
          <Card title="Profit report">
            <Empty>No design costs yet. Open the Designs tab, click Edit on each design and enter its cost per suit. This report fills in automatically.</Empty>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Sales (designs with cost)" value={pkr(r.pRevenue)} />
              <Stat label="Cost of suits" value={pkr(r.pCost)} />
              <Stat label="Gross profit" value={<span className={r.pProfit < 0 ? 'text-red-600' : 'text-green-700'}>{pkr(r.pProfit)}</span>} />
              <Stat label="Profit margin" value={`${r.pMargin.toFixed(1)}%`} note="Gross profit ÷ sales" />
            </div>

            {(r.lossRows.length > 0 || r.lowMargin.length > 0) && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-2">
                <p className="text-sm font-bold text-red-700">⚠ Profit warnings</p>
                {r.lossRows.map(x => (
                  <p key={x.name} className="text-sm text-red-700">
                    <span className="font-semibold">{x.name}</span> made a loss of {pkr(-x.profit)} (average price {pkr(x.avgPrice)} vs cost {pkr(x.unitCost)}).
                  </p>
                ))}
                {r.lowMargin.map(x => (
                  <p key={x.name} className="text-sm text-amber-700">
                    <span className="font-semibold">{x.name}</span> has a low margin of {x.margin.toFixed(0)}%.
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card title="Most profitable designs" subtitle="Top 10 by gross profit in this period.">
                <RankBars rows={r.mostProfitable} valueKey="profit" color={C.aqua} labelFmt={kTick}
                  tipLines={(x) => [['Gross profit', pkr(x.profit)], ['Margin', `${x.margin.toFixed(0)}%`], ['Suits', fmt(x.qty)]]} />
              </Card>
              <Card title="Profit by design" subtitle="Sales, cost and profit for every design that has a cost.">
                <div className="max-h-[420px] overflow-y-auto">
                  <SimpleTable rows={r.profitRows} columns={[
                    ['Design', (x) => <span className="font-semibold text-gray-900">{x.name}</span>],
                    ['Suits', (x) => fmt(x.qty), 'right'],
                    ['Sales', (x) => fmt(x.amount), 'right'],
                    ['Cost', (x) => fmt(x.cost), 'right'],
                    ['Profit', (x) => <span className={`font-bold ${x.profit < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(x.profit)}</span>, 'right'],
                    ['Margin', (x) => `${x.margin.toFixed(0)}%`, 'right'],
                  ]} />
                </div>
              </Card>
            </div>

            <p className="text-xs text-gray-500">
              Costs entered for {r.costedDesigns} of {r.activeDesigns} active designs.
              {r.noCostSuits > 0 && ` ${fmt(r.noCostSuits)} suits (${pkr(r.noCostAmount)}) in this period are from designs without a cost and are not counted.`}
              {' '}Profit uses each design's current cost for all sales, including older ones.
            </p>
          </>
        )
      )}

      {report === 'designs' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Top 10 by suits sold" subtitle="Old spellings are counted under the real design.">
              <RankBars rows={r.topDesigns} valueKey="qty" tipLines={(x) => [['Suits', fmt(x.qty)], ['Sales amount', pkr(x.amount)]]} />
            </Card>
            <Card title="Top 10 by sales amount" subtitle="Which designs bring in the most money.">
              <RankBars rows={r.topRevenue} valueKey="amount" color={C.blue} labelFmt={kTick} tipLines={(x) => [['Sales amount', pkr(x.amount)], ['Suits', fmt(x.qty)]]} />
            </Card>
          </div>
          <Card title="Slow-moving designs" subtitle="Active designs with the fewest suits sold in this period (zero included).">
            <SimpleTable rows={r.slow} columns={[
              ['Design', (x) => <span className="font-semibold text-gray-900">{x.name}</span>],
              ['Suits', (x) => <span className={`font-bold ${x.qty === 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(x.qty)}</span>, 'right'],
              ['Sales amount', (x) => pkr(x.amount), 'right'],
            ]} />
          </Card>
        </>
      )}

      {report === 'sizes' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Suits sold by size" subtitle="Hover a bar to see the sales amount.">
              {r.sizeTotal === 0 ? <Empty>No sizes in this period.</Empty> : (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={r.sizes} margin={{ top: 20, right: 8, left: 4, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid stroke={C.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: C.text2, fontSize: 12, fontWeight: 700 }} stroke={C.axis} tickLine={false} />
                      <YAxis tick={axisTick} stroke={C.axis} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                      <Tooltip cursor={{ fill: '#f3f2ee' }} content={<Tip lines={(x) => [['Suits', fmt(x.qty)], ['Share', `${r.sizeTotal ? Math.round((x.qty / r.sizeTotal) * 100) : 0}%`], ['Sales amount', pkr(x.amount)]]} />} />
                      <Bar dataKey="qty" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                        {r.sizes.map(x => <Cell key={x.name} fill={SIZE_COLORS[x.name]} />)}
                        <LabelList dataKey="qty" position="top" formatter={fmt} style={{ fill: C.text2, fontSize: 11, fontWeight: 700 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card title="Size details" subtitle="Share of all suits, sales amount, and the best-selling design in each size.">
              <SimpleTable rows={r.sizes.map((x, i) => ({ ...x, top: r.sizeTop[i] }))} columns={[
                ['Size', (x) => <span className="flex items-center gap-2 font-bold text-gray-900"><span className="w-3 h-3 rounded-sm" style={{ background: SIZE_COLORS[x.name] }} />{x.name}</span>],
                ['Suits', (x) => fmt(x.qty), 'right'],
                ['Share', (x) => `${r.sizeTotal ? Math.round((x.qty / r.sizeTotal) * 100) : 0}%`, 'right'],
                ['Sales amount', (x) => pkr(x.amount), 'right'],
                ['Top design', (x) => x.top.qty ? <span>{x.top.design} <span className="text-gray-400">({fmt(x.top.qty)})</span></span> : <span className="text-gray-300">-</span>],
              ]} />
            </Card>
          </div>
        </>
      )}

      {report === 'fabric' && (
        r.fabrics.length === 0 ? (
          <Card title="Fabric report"><Empty>No fabric data yet. Add a fabric to each design in the Designs tab and this report will fill in.</Empty></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card title="Suits sold by fabric" subtitle="Hover a bar to see the sales amount.">
                <RankBars rows={r.fabrics} valueKey="qty" nameWidth={120} tipLines={(x) => [['Suits', fmt(x.qty)], ['Sales amount', pkr(x.amount)], ['Designs', fmt(x.designCount)]]} />
              </Card>
              <Card title="Fabric details" subtitle="Share of suits that have a fabric set.">
                <SimpleTable rows={r.fabrics} columns={[
                  ['Fabric', (x) => <span className="font-semibold text-gray-900">{x.name}</span>],
                  ['Designs', (x) => fmt(x.designCount), 'right'],
                  ['Suits', (x) => fmt(x.qty), 'right'],
                  ['Share', (x) => `${r.fabricSuits ? Math.round((x.qty / r.fabricSuits) * 100) : 0}%`, 'right'],
                  ['Sales amount', (x) => pkr(x.amount), 'right'],
                ]} />
              </Card>
            </div>
            {r.noFabricSuits > 0 && <p className="text-xs text-amber-700">{fmt(r.noFabricSuits)} suits in this period belong to designs without a fabric and are not counted above.</p>}
          </>
        )
      )}

      {report === 'delivery' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card title="Advance vs COD" subtitle="Orders by payment method.">
              <SegmentBar parts={r.pay} colors={{ Advance: C.blue, COD: C.orange }} unit="orders" />
            </Card>
            <Card title="COD paid vs unpaid" subtitle="COD orders by payment status.">
              <SegmentBar parts={r.codStatus} colors={{ Paid: C.aqua, Unpaid: C.orange }} unit="orders" />
            </Card>
            <Card title="COD delivery channel" subtitle="Who delivered the COD orders.">
              <SegmentBar parts={r.channel} colors={{ PostEx: C.blue, 'D&D': C.aqua, 'Service Delivery': C.yellow }} unit="orders" />
            </Card>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Local Rider · parcels by city" subtitle="Every city, not only the top 3.">
              <RankBars rows={r.riderCities} valueKey="parcels" color={C.aqua} nameWidth={120} tipLines={(x) => [['Parcels', fmt(x.parcels)], ['Sales amount', pkr(x.amount)]]} />
            </Card>
            <Card title="PostEx · parcels by city" subtitle="City from the order, or from the order-code letters (e.g. PES = Peshawar).">
              <RankBars rows={r.postexCities} valueKey="parcels" color={C.blue} nameWidth={120} tipLines={(x) => [['Parcels', fmt(x.parcels)], ['Sales amount', pkr(x.amount)]]} />
            </Card>
          </div>
        </>
      )}

      {report === 'customers' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat label="Customers" value={fmt(r.customerCount)} />
            <Stat label="Repeat customers" value={fmt(r.repeat)} note="Ordered more than once" />
            <Stat label="Repeat rate" value={`${r.customerCount ? Math.round((r.repeat / r.customerCount) * 100) : 0}%`} />
          </div>
          <Card title="Top 15 customers by spending" subtitle="Names as typed on orders. Different spellings of one name are not merged yet.">
            <SimpleTable rows={r.customers} columns={[
              ['#', (x) => <span className="text-gray-400 font-bold">{r.customers.indexOf(x) + 1}</span>],
              ['Customer', (x) => <span className="font-semibold text-gray-900">{x.name}</span>],
              ['Orders', (x) => fmt(x.orders), 'right'],
              ['Suits', (x) => fmt(x.suits), 'right'],
              ['Spent', (x) => pkr(x.amount), 'right'],
            ]} />
          </Card>
        </>
      )}

      {r.unlinked > 0 && (
        <p className="text-xs text-amber-700">{r.unlinked} order line(s) in this period are not linked to a design yet (shown as "unlinked").</p>
      )}
      <p className="text-xs text-gray-400">Profit is gross profit (sales minus suit cost). Expenses such as rent and salaries are not included.</p>
    </div>
  );
}