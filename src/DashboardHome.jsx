// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import { supabase } from './supabaseClient';

// Dashboard home (design refresh v2: calmer layout, today's sales, last-14-days chart).
// Uses ONLY real data already loaded by App (sales) plus the designs list (for fabric).
// Nothing is written. Online sales only; Khata is not included.

const BRAND = '#5b4cf0';
const CITY_COLORS = ['#2a78d6', '#1baf7a', '#eb6834', '#b8b6ae'];
const FABRIC_COLORS = ['#5b4cf0', '#2a78d6', '#1baf7a', '#eb6834', '#b8b6ae'];
const SIZE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const titleCase = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const MUTED = '#898781';
const GRID = '#ecebe6';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const pkr = (n) => `PKR ${fmt(n)}`;
const pad = (n) => String(n).padStart(2, '0');
const key = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseHour(displayTime) {
  const m = String(displayTime || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') h += 12;
  return h;
}
const hourLabel = (h) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;

function timeAgoFromId(id) {
  const ms = Number(id);
  if (!Number.isFinite(ms) || ms < 1e12) return '';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

// Top 3 entries + one "Other" entry that remembers which names it contains.
function topWithOther(counts, topN = 3) {
  const sorted = Array.from(counts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  if (rest.length) {
    top.push({
      name: `Other (${rest.length} ${rest.length === 1 ? 'city' : 'cities'})`,
      value: rest.reduce((a, c) => a + c.value, 0),
      names: rest.map(r => `${r.name} (${r.value})`),
    });
  }
  return top;
}

// ---------- Small building blocks ----------
function Money({ value, size = 'text-2xl' }) {
  return (
    <span className={`${size} font-black text-gray-900 tracking-tight`}>
      <span className="text-sm font-bold text-gray-400 mr-1">PKR</span>{fmt(value)}
    </span>
  );
}

function Change({ pct }) {
  if (pct == null) return <span className="text-xs text-gray-400">No data last month</span>;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap px-2 py-0.5 rounded-full ${up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
      title="Compared with the same days of last month"
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% vs last month
    </span>
  );
}

function Spark({ data, color }) {
  if (!data || data.length < 2) return null;
  const id = `spark-${color.slice(1)}`;
  return (
    <div style={{ width: '100%', height: 36 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const ICONS = {
  today: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  month: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  orders: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  pending: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
};

function KpiCard({ tone, icon, label, children, footer, spark, sparkColor, onClick, hint = 'View records' }) {
  const iconBg = {
    violet: 'bg-violet-100 text-violet-700',
    blue: 'bg-sky-100 text-sky-700',
    green: 'bg-emerald-100 text-emerald-700',
    orange: 'bg-orange-100 text-orange-700',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/card text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col transition hover:border-indigo-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="flex items-center gap-2.5 w-full">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg[tone]}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
          </svg>
        </span>
        <span className="text-sm font-semibold text-gray-500">{label}</span>
        <span className="ml-auto text-[11px] font-bold text-indigo-600 opacity-0 group-hover/card:opacity-100 transition-opacity whitespace-nowrap">{hint} →</span>
      </div>
      <div className="mt-3">{children}</div>
      <div className="mt-2 min-h-[22px]">{footer}</div>
      {spark && <div className="mt-2 w-full"><Spark data={spark} color={sparkColor} /></div>}
    </button>
  );
}

function Panel({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function LinkButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
      {children} →
    </button>
  );
}

function Donut({ data, colors, centerTop, centerBottom, unit = '' }) {
  const total = data.reduce((a, d) => a + (Number(d.value) || 0), 0);
  return (
    <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="#ffffff" strokeWidth={2} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={d.name} fill={colors[i % colors.length]} />)}
          </Pie>
          {/* Tooltip is drawn ABOVE the ring (outside the circle) so it never covers the centre text */}
          <Tooltip
            position={{ x: 0, y: -62 }}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const d = payload[0].payload;
              const pct = total ? Math.round((d.value / total) * 100) : 0;
              return (
                <div className="bg-gray-900 text-white rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                  <p className="font-bold">{d.name}</p>
                  <p className="text-gray-300">{fmt(d.value)} {unit} · {pct}%</p>
                  {d.names && <p className="text-gray-400 mt-1 max-w-[220px] whitespace-normal">{d.names.join(', ')}</p>}
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-black text-gray-900">{centerTop}</span>
        <span className="text-[11px] font-semibold text-gray-500">{centerBottom}</span>
      </div>
    </div>
  );
}

function LegendList({ data, colors, total }) {
  return (
    <ul className="space-y-2 flex-1 min-w-0">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center justify-between gap-3 text-sm" title={d.names ? d.names.join(', ') : undefined}>
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className={`font-medium text-gray-800 truncate ${d.names ? 'underline decoration-dotted cursor-help' : ''}`}>{d.name}</span>
          </span>
          <span className="font-bold text-gray-900">{total ? Math.round((d.value / total) * 100) : 0}%</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Main ----------
export default function DashboardHome({ sales = [], canonicalDesignName = (n) => n, onOpenSale, onGoTo, onShowOrders }) {
  const [fabricByName, setFabricByName] = useState({});
  const [period, setPeriod] = useState('week');
  const [postExCityByPrefix, setPostExCityByPrefix] = useState({});

  useEffect(() => {
    let alive = true;
    supabase.from('postex_city_codes').select('prefix, city').then(({ data, error }) => {
      if (error) { console.error('Could not load PostEx city codes:', error); return; }
      if (!alive) return;
      const map = {};
      (data || []).forEach(r => { map[String(r.prefix).trim().toUpperCase()] = r.city; });
      setPostExCityByPrefix(map);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.from('designs').select('name, fabric').then(({ data, error }) => {
      if (error || !alive) return;
      const map = {};
      (data || []).forEach(d => { if (d.fabric && d.fabric.trim()) map[key(d.name)] = titleCase(d.fabric); });
      setFabricByName(map);
    });
    return () => { alive = false; };
  }, []);

  const s = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const todayNum = now.getDate();
    const todayStr = dayKey(now);
    const thisPrefix = `${y}-${pad(m + 1)}`;
    const last = new Date(y, m - 1, 1);
    const lastPrefix = `${last.getFullYear()}-${pad(last.getMonth() + 1)}`;

    const sum = (arr, f) => arr.reduce((a, x) => a + (Number(x[f]) || 0), 0);
    const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

    const today = sales.filter(x => x.dateStr === todayStr);
    const thisMonth = sales.filter(x => x.dateStr && x.dateStr.startsWith(thisPrefix));
    const lastMonth = sales.filter(x => x.dateStr && x.dateStr.startsWith(lastPrefix));
    const lastSameDays = lastMonth.filter(x => Number(x.dateStr.slice(8, 10)) <= todayNum);

    // Last 14 days (including today)
    const byDay = new Map();
    sales.forEach(x => {
      if (!x.dateStr) return;
      const r = byDay.get(x.dateStr) || { revenue: 0, orders: 0 };
      r.revenue += Number(x.totalAmount) || 0;
      r.orders += 1;
      byDay.set(x.dateStr, r);
    });
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(y, m, todayNum - i);
      const k = dayKey(d);
      const r = byDay.get(k) || { revenue: 0, orders: 0 };
      last14.push({
        key: k,
        label: i === 0 ? 'Today' : `${d.getDate()} ${MON3[d.getMonth()]}`,
        tip: `${DAYS[d.getDay()]}, ${d.getDate()} ${MON3[d.getMonth()]}`,
        revenue: r.revenue,
        orders: r.orders,
        isToday: i === 0,
      });
    }
    const last14Total = last14.reduce((a, d) => a + d.revenue, 0);
    const monthSpark = [];
    for (let d = 1; d <= todayNum; d++) {
      monthSpark.push({ v: (byDay.get(`${thisPrefix}-${pad(d)}`) || { revenue: 0 }).revenue });
    }

    // Pending COD
    const pending = sales.filter(x => x.paymentMethod === 'Cash on Delivery' && (x.cod_paid || 'No') === 'No');

    // Top designs this month (fallback: last month)
    const topSource = thisMonth.length ? thisMonth : lastMonth;
    const topPeriod = thisMonth.length ? MONTHS[m] : MONTHS[last.getMonth()];
    const designMap = new Map();
    topSource.forEach(x => (x.items || []).forEach(it => {
      const name = canonicalDesignName(it.itemName) || 'Unknown';
      const d = designMap.get(name) || { name, qty: 0, amount: 0 };
      d.qty += Number(it.itemTotalQty) || 0;
      d.amount += Number(it.itemTotalAmount) || 0;
      designMap.set(name, d);
    }));
    const top = Array.from(designMap.values()).sort((a, b) => b.qty - a.qty || b.amount - a.amount).slice(0, 5);

    // All-time insights
    const dayRevenue = Array(7).fill(0);
    const hourCount = Array(24).fill(0);
    sales.forEach(x => {
      if (x.dateStr) {
        const [yy, mm, dd] = x.dateStr.split('-').map(Number);
        dayRevenue[new Date(yy, mm - 1, dd).getDay()] += Number(x.totalAmount) || 0;
      }
      const h = parseHour(x.displayTime);
      if (h != null) hourCount[h] += 1;
    });
    const allRevenue = sum(sales, 'totalAmount');
    let bestStart = null;
    let bestWin = 0;
    for (let h = 0; h < 24; h++) {
      const w = hourCount[h] + hourCount[(h + 1) % 24] + hourCount[(h + 2) % 24];
      if (w > bestWin) { bestWin = w; bestStart = h; }
    }

    // Local rider cities (all time)
    const riderSales = sales.filter(x => x.paymentMethod === 'Cash on Delivery' && (x.cod_sub_option || '') === 'Local Rider');
    const cityMap = new Map();
    riderSales.forEach(x => {
      const c = (x.city || 'Unknown').trim() || 'Unknown';
      cityMap.set(c, (cityMap.get(c) || 0) + 1);
    });
    const cities = topWithOther(cityMap);

    // PostEx cities (all time): city typed on the order, else from the order-code prefix (e.g. PES-476 -> Peshawar)
    const postExSales = sales.filter(x => x.paymentMethod === 'Cash on Delivery' && (x.cod_sub_option || '') === 'PostEx');
    const postExMap = new Map();
    postExSales.forEach(x => {
      const prefix = String(x.orderCode || '').split('-')[0].trim().toUpperCase();
      const c = (x.city || '').trim() || postExCityByPrefix[prefix] || 'Unknown';
      postExMap.set(c, (postExMap.get(c) || 0) + 1);
    });
    const postExCities = topWithOther(postExMap);

    // Sizes sold (all time, suits)
    const sizeTotals = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    sales.forEach(x => (x.items || []).forEach(it => {
      Object.keys(sizeTotals).forEach(sz => { sizeTotals[sz] += Number(it.sizeQty?.[sz]) || 0; });
    }));
    const sizes = Object.entries(sizeTotals).map(([name, value]) => ({ name, value })); // keep all 5 so each size keeps its colour
    const sizesTotal = sizes.reduce((a, d) => a + d.value, 0);
    const topSize = sizes.slice().sort((a, b) => b.value - a.value)[0];

    // Fabric share (all time, suits)
    const fabricMap = new Map();
    let fabricKnown = 0;
    sales.forEach(x => (x.items || []).forEach(it => {
      const f = fabricByName[key(canonicalDesignName(it.itemName))];
      if (!f) return;
      const q = Number(it.itemTotalQty) || 0;
      fabricKnown += q;
      fabricMap.set(f, (fabricMap.get(f) || 0) + q);
    }));
    const fabricSorted = Array.from(fabricMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const fabrics = fabricSorted.slice(0, 4);
    const otherFabric = fabricSorted.slice(4).reduce((a, c) => a + c.value, 0);
    if (otherFabric > 0) fabrics.push({ name: 'Other', value: otherFabric });

    return {
      monthName: MONTHS[m],
      todayRevenue: sum(today, 'totalAmount'), todayOrders: today.length, todaySuits: sum(today, 'totalQty'),
      revThis: sum(thisMonth, 'totalAmount'), revPct: pct(sum(thisMonth, 'totalAmount'), sum(lastSameDays, 'totalAmount')),
      ordersThis: thisMonth.length, ordersPct: pct(thisMonth.length, lastSameDays.length),
      suitsThis: sum(thisMonth, 'totalQty'),
      pendingAmount: sum(pending, 'totalAmount'), pendingCount: pending.length,
      last14, last14Total, monthSpark,
      top, topPeriod,
      bestDay: allRevenue > 0 ? DAYS[dayRevenue.indexOf(Math.max(...dayRevenue))] : '-',
      peak: bestStart != null && bestWin > 0 ? `${hourLabel(bestStart)} – ${hourLabel((bestStart + 3) % 24)}` : '-',
      aov: sales.length ? allRevenue / sales.length : 0,
      cities, riderTotal: riderSales.length,
      postExCities, postExTotal: postExSales.length,
      sizes, sizesTotal, topSize,
      fabrics, fabricKnown,
      recent: sales.slice(0, 6),
    };
  }, [sales, canonicalDesignName, fabricByName, postExCityByPrefix]);

  // ---------- Sales Overview chart (Today / This Week / This Month / This Year) ----------
  const chart = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const todayStr = dayKey(now);
    const sumOf = (arr) => arr.reduce((a, x) => a + (Number(x.totalAmount) || 0), 0);
    const inRange = (from, to) => sales.filter(x => x.dateStr && x.dateStr >= from && x.dateStr <= to);
    let rows = [];
    let cur = [];
    let prev = [];
    let prevLabel = '';
    let range = [todayStr, todayStr];

    if (period === 'today') {
      cur = inRange(todayStr, todayStr);
      const yest = dayKey(new Date(y, m, d - 1));
      prev = inRange(yest, yest);
      prevLabel = 'yesterday';
      const byHour = Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), tip: hourLabel(h), revenue: 0, orders: 0 }));
      cur.forEach(x => {
        const h = parseHour(x.displayTime);
        if (h != null) { byHour[h].revenue += Number(x.totalAmount) || 0; byHour[h].orders += 1; }
      });
      const firstH = byHour.findIndex(r => r.orders > 0);
      const start = Math.min(firstH === -1 ? 9 : firstH, 9);
      rows = byHour.slice(start, Math.max(now.getHours() + 1, start + 1));
    } else if (period === 'week') {
      const offset = (now.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(y, m, d - offset);
      const lastMonday = new Date(y, m, d - offset - 7);
      const lastSameDay = new Date(y, m, d - 7);
      range = [dayKey(monday), todayStr];
      cur = inRange(dayKey(monday), todayStr);
      prev = inRange(dayKey(lastMonday), dayKey(lastSameDay));
      prevLabel = 'same days last week';
      for (let i = 0; i < 7; i++) {
        const day = new Date(y, m, d - offset + i);
        const k = dayKey(day);
        const list = day <= now ? inRange(k, k) : null;
        rows.push({
          label: `${DAYS[day.getDay()].slice(0, 3)} ${day.getDate()}`,
          tip: `${DAYS[day.getDay()]}, ${day.getDate()} ${MON3[day.getMonth()]}`,
          revenue: list ? sumOf(list) : null,
          orders: list ? list.length : 0,
        });
      }
    } else if (period === 'month') {
      const first = `${y}-${pad(m + 1)}-01`;
      range = [first, todayStr];
      cur = inRange(first, todayStr);
      const lastFirst = dayKey(new Date(y, m - 1, 1));
      const lastSame = dayKey(new Date(y, m - 1, Math.min(d, new Date(y, m, 0).getDate())));
      prev = inRange(lastFirst, lastSame);
      prevLabel = 'same days last month';
      for (let i = 1; i <= d; i++) {
        const k = `${y}-${pad(m + 1)}-${pad(i)}`;
        const list = inRange(k, k);
        rows.push({ label: `${i} ${MON3[m]}`, tip: `${i} ${MON3[m]}`, revenue: sumOf(list), orders: list.length });
      }
    } else {
      const first = `${y}-01-01`;
      range = [first, todayStr];
      cur = inRange(first, todayStr);
      prev = inRange(`${y - 1}-01-01`, `${y - 1}-${todayStr.slice(5)}`);
      prevLabel = 'same period last year';
      for (let i = 0; i <= m; i++) {
        const pre = `${y}-${pad(i + 1)}`;
        const list = sales.filter(x => x.dateStr && x.dateStr.startsWith(pre));
        rows.push({ label: MON3[i], tip: `${MONTHS[i]} ${y}`, revenue: sumOf(list), orders: list.length });
      }
    }

    const revenue = sumOf(cur);
    const prevRevenue = sumOf(prev);
    const change = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    return {
      rows, revenue, orders: cur.length, range, prevLabel,
      revenueChange: change(revenue, prevRevenue),
      ordersChange: change(cur.length, prev.length),
      prevRevenue, prevOrders: prev.length,
    };
  }, [sales, period]);

  const Trend = ({ pct }) => {
    if (pct == null) return <span className="text-xs text-gray-400">no data for {chart.prevLabel}</span>;
    const up = pct >= 0;
    return (
      <span className={`text-xs font-bold ${up ? 'text-green-700' : 'text-red-600'}`}>
        {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% <span className="font-medium text-gray-500">vs {chart.prevLabel}</span>
      </span>
    );
  };

  const now = new Date();
  const todayKey = dayKey(now);
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const topMax = s.top.length ? s.top[0].qty : 0;

  return (
    <div className="space-y-6">
      {/* Row 1: KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard tone="violet" icon={ICONS.today} label="Today's Sales"
          onClick={() => onShowOrders && onShowOrders(todayKey, todayKey)}
          footer={<span className="text-xs font-semibold text-gray-500">{fmt(s.todayOrders)} orders · {fmt(s.todaySuits)} suits</span>}>
          <Money value={s.todayRevenue} />
        </KpiCard>
        <KpiCard tone="blue" icon={ICONS.month} label={`${s.monthName} Sales`}
          onClick={() => onShowOrders && onShowOrders(monthStart, todayKey)}
          footer={<Change pct={s.revPct} />} spark={s.monthSpark} sparkColor={BRAND}>
          <Money value={s.revThis} />
        </KpiCard>
        <KpiCard tone="green" icon={ICONS.orders} label={`${s.monthName} Orders`}
          onClick={() => onShowOrders && onShowOrders(monthStart, todayKey)}
          footer={<Change pct={s.ordersPct} />}>
          <span className="text-2xl font-black text-gray-900">{fmt(s.ordersThis)}</span>
          <span className="text-sm font-semibold text-gray-400 ml-2">{fmt(s.suitsThis)} suits</span>
        </KpiCard>
        <KpiCard tone="orange" icon={ICONS.pending} label="Pending COD"
          onClick={() => onGoTo && onGoTo('Pending Payments')}
          footer={<span className="text-xs font-bold text-orange-700">{fmt(s.pendingCount)} unpaid orders</span>}>
          <Money value={s.pendingAmount} />
        </KpiCard>
      </div>

      {/* Row 2: last 14 days + top designs */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Panel
          className="xl:col-span-3"
          title="Sales Overview"
          action={
            <div className="flex bg-gray-100 rounded-lg p-0.5 max-w-full overflow-x-auto">
              {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setPeriod(k)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${period === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button type="button" onClick={() => onShowOrders && onShowOrders(chart.range[0], chart.range[1])} className="text-left rounded-xl bg-indigo-50/60 border border-indigo-100 p-3 hover:border-indigo-300">
              <p className="text-xs font-semibold text-gray-500">Sales amount</p>
              <p className="text-xl font-black text-gray-900"><span className="text-xs font-bold text-gray-400 mr-1">PKR</span>{fmt(chart.revenue)}</p>
              <Trend pct={chart.revenueChange} />
            </button>
            <button type="button" onClick={() => onShowOrders && onShowOrders(chart.range[0], chart.range[1])} className="text-left rounded-xl bg-gray-50 border border-gray-100 p-3 hover:border-indigo-300">
              <p className="text-xs font-semibold text-gray-500">Number of orders</p>
              <p className="text-xl font-black text-gray-900">{fmt(chart.orders)}</p>
              <Trend pct={chart.ordersChange} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-1">
            Bars show the sales amount in PKR{period === 'today' ? ' per hour' : period === 'year' ? ' per month' : ' per day'}. Hover a bar to see orders.
          </p>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={chart.rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#d6d5cf' }} interval="preserveStartEnd" minTickGap={10} />
                <YAxis tick={{ fill: MUTED, fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip
                  cursor={{ fill: '#f3f2ee' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const r = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
                        <p className="font-bold text-gray-900 mb-1">{r.tip}</p>
                        <p className="text-gray-600">Sales amount: <span className="font-semibold text-gray-900">{r.revenue == null ? '-' : pkr(r.revenue)}</span></p>
                        <p className="text-gray-600">Orders: <span className="font-semibold text-gray-900">{r.orders}</span></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenue" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {chart.orders === 0 && <p className="text-xs text-gray-400 mt-2">No sales in this period yet.</p>}
        </Panel>

        <Panel
          className="xl:col-span-2"
          title={`Top Designs · ${s.topPeriod}`}
          action={<LinkButton onClick={() => onGoTo && onGoTo('Top Selling Designs')}>View all</LinkButton>}
        >
          {s.top.length === 0 ? (
            <p className="text-sm text-gray-400">No sales yet.</p>
          ) : (
            <ol className="space-y-3.5">
              {s.top.map((d, i) => (
                <li key={d.name} className="flex items-center gap-3">
                  <span className="w-6 text-sm font-black text-gray-300 text-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">{d.name}</span>
                      <span className="text-xs font-bold text-gray-700 shrink-0">{fmt(d.qty)} suits</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${topMax ? (d.qty / topMax) * 100 : 0}%`, background: BRAND }} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {/* Row 3: recent orders + quick insights */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Panel
          className="xl:col-span-3" title="Recent Orders"
          action={<LinkButton onClick={() => onGoTo && onGoTo('Orders')}>All orders</LinkButton>}
        >
          <ul className="divide-y divide-gray-100 -mx-1">
            {s.recent.map(x => {
              const isCod = x.paymentMethod === 'Cash on Delivery';
              const paid = (x.cod_paid || 'No') === 'Yes';
              const status = !isCod
                ? ['Advance', 'bg-green-50 text-green-700']
                : paid ? ['COD paid', 'bg-green-50 text-green-700'] : ['COD unpaid', 'bg-red-50 text-red-600'];
              const designs = (x.items || []).map(it => canonicalDesignName(it.itemName)).join(', ');
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => onOpenSale && onOpenSale(x)} className="w-full flex items-center gap-3 py-2.5 px-1 text-left hover:bg-gray-50 rounded-lg">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 truncate">{x.customerName}</span>
                      <span className="block text-xs text-gray-500 truncate">#{x.orderNumber} · {designs}</span>
                    </span>
                    <span className="hidden sm:block text-xs text-gray-400 whitespace-nowrap">{timeAgoFromId(x.id) || x.displayDate}</span>
                    <span className="text-sm font-bold text-gray-900 whitespace-nowrap w-20 text-right">{fmt(x.totalAmount)}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${status[1]}`}>{status[0]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="xl:col-span-2" title="Quick Insights (all time)">
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3">
            {[
              ['Best day', s.bestDay],
              ['Busiest time', s.peak],
              ['Average order', pkr(s.aov)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">AI recommendations will appear here after the AI Assistant step.</p>
        </Panel>
      </div>

      {/* Row 4: delivery by city + fabric */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Local Rider Delivery"
          action={<LinkButton onClick={() => onGoTo && onGoTo('D&D Parcels')}>Details</LinkButton>}
        >
          {s.cities.length === 0 ? (
            <p className="text-sm text-gray-400">No local rider parcels yet.</p>
          ) : (
            <div className="flex items-center gap-5">
              <Donut data={s.cities} colors={CITY_COLORS} unit="parcels" centerTop={fmt(s.riderTotal)} centerBottom="parcels" />
              <LegendList data={s.cities} colors={CITY_COLORS} total={s.riderTotal} />
            </div>
          )}
        </Panel>
        <Panel
          title="PostEx Delivery"
          action={<LinkButton onClick={() => onGoTo && onGoTo('PostEx Orders')}>Details</LinkButton>}
        >
          {s.postExCities.length === 0 ? (
            <p className="text-sm text-gray-400">No PostEx parcels yet.</p>
          ) : (
            <div className="flex items-center gap-5">
              <Donut data={s.postExCities} colors={CITY_COLORS} unit="parcels" centerTop={fmt(s.postExTotal)} centerBottom="parcels" />
              <LegendList data={s.postExCities} colors={CITY_COLORS} total={s.postExTotal} />
            </div>
          )}
        </Panel>
        <Panel
          title="Sizes Sold (all time)"
          action={<LinkButton onClick={() => onGoTo && onGoTo('Charts')}>More charts</LinkButton>}
        >
          {s.sizesTotal === 0 ? (
            <p className="text-sm text-gray-400">No sizes recorded yet.</p>
          ) : (
            <div className="flex items-center gap-5">
              <Donut data={s.sizes} colors={SIZE_COLORS} unit="suits" centerTop={s.topSize.name} centerBottom="most sold" />
              <LegendList data={s.sizes} colors={SIZE_COLORS} total={s.sizesTotal} />
            </div>
          )}
        </Panel>
        <Panel title="Fabric Mix (all time)">
          {s.fabrics.length === 0 ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">Add a fabric to each design and this chart will appear.</p>
              <LinkButton onClick={() => onGoTo && onGoTo('Designs')}>Open Designs</LinkButton>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <Donut data={s.fabrics} colors={FABRIC_COLORS} unit="suits" centerTop={`${Math.round((s.fabrics[0].value / s.fabricKnown) * 100)}%`} centerBottom={s.fabrics[0].name} />
              <LegendList data={s.fabrics} colors={FABRIC_COLORS} total={s.fabricKnown} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}