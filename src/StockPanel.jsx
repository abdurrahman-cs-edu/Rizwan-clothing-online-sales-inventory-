// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

// "Stock" tab: how many suits are left of each design, and which designs are finished.
// Stock comes from the shop's retail software (Inventory.sqlite3). The admin chooses a copy of
// that file; the browser reads only the `stock` table and sends name + quantity + price to the
// Edge Function `retail-sync`. Customers, bills, costs and passwords never leave the shop PC.

const LOW_STOCK = 3;
const SQLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';

let sqlJsPromise = null;
function loadSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = new Promise((resolve, reject) => {
      if (window.initSqlJs) return resolve(window.initSqlJs);
      const s = document.createElement('script');
      s.src = `${SQLJS_BASE}sql-wasm.js`;
      s.onload = () => resolve(window.initSqlJs);
      s.onerror = () => reject(new Error('Could not load the SQLite reader. Check the internet connection.'));
      document.head.appendChild(s);
    })
      .then((init) => init({ locateFile: (f) => `${SQLJS_BASE}${f}` }))
      .catch((e) => { sqlJsPromise = null; throw e; });
  }
  return sqlJsPromise;
}

// Reads only the stock table from the retail software's SQLite file.
async function readRetailStock(file) {
  const SQL = await loadSqlJs();
  const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
  try {
    const res = db.exec('SELECT id, name, quantity, r_price, status FROM stock');
    if (!res.length) return [];
    return res[0].values.map(([id, name, quantity, rPrice, status]) => ({
      item_id: id,
      name: String(name || '').trim(),
      quantity: Number(quantity) || 0,
      retail_price: rPrice == null ? null : Number(rPrice),
      active: Number(status) !== 0,
    })).filter((r) => r.name);
  } catch {
    throw new Error('This file does not look like the retail software database (no "stock" table).');
  } finally {
    db.close();
  }
}

function StockBadge({ qty }) {
  const cls = qty <= 0 ? 'bg-red-50 text-red-600' : qty <= LOW_STOCK ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700';
  const text = qty <= 0 ? 'Out of stock' : `${qty} left`;
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${cls}`}>{text}</span>;
}

export default function StockPanel({ isAdmin }) {
  const [items, setItems] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [soldOnline, setSoldOnline] = useState({});
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | out | low | in
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null); // { ok, text }
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const [stockRes, designRes, logRes, linesRes] = await Promise.all([
      supabase.from('retail_stock').select('item_id, name, design_id, match_source, quantity, retail_price, is_active, synced_at'),
      supabase.from('designs').select('id, name, is_active').order('name'),
      supabase.from('retail_sync_log').select('synced_at, items, total_quantity').order('id', { ascending: false }).limit(1),
      supabase.from('design_lines').select('design_id, qty').eq('source', 'sale').gte('sale_date', since),
    ]);
    if (stockRes.error) console.error('Could not load stock:', stockRes.error);
    setItems(stockRes.data || []);
    setDesigns(designRes.data || []);
    setLastSync(logRes.data?.[0] || null);
    const sold = {};
    (linesRes.data || []).forEach((l) => { if (l.design_id) sold[l.design_id] = (sold[l.design_id] || 0) + (Number(l.qty) || 0); });
    setSoldOnline(sold);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || syncing) return;
    setSyncing(true);
    setSyncMsg({ ok: true, text: 'Reading the file...' });
    try {
      const rows = await readRetailStock(file);
      if (!rows.length) throw new Error('No stock items found in this file.');
      setSyncMsg({ ok: true, text: `Uploading ${rows.length} items...` });
      const { data, error } = await supabase.functions.invoke('retail-sync', { body: { action: 'sync', items: rows } });
      if (error || !data) throw new Error('Could not reach the server. Please try again.');
      if (!data.ok) throw new Error(data.error || 'Could not update the stock.');
      setSyncMsg({ ok: true, text: `Stock updated: ${data.items} items, ${Number(data.total_quantity).toLocaleString()} suits, ${data.linked} linked to designs.` });
      await load();
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message || 'Could not update the stock.' });
    } finally {
      setSyncing(false);
    }
  };

  const linkItem = async (itemId, designId) => {
    const { data, error } = await supabase.functions.invoke('retail-sync', {
      body: { action: 'set_match', item_id: itemId, design_id: designId || null },
    });
    if (error || !data?.ok) return window.alert(data?.error || 'Could not save the link.');
    load();
  };

  // One row per design (all its retail items added together) + items not linked to a design.
  const rows = useMemo(() => {
    const designName = Object.fromEntries(designs.map((d) => [d.id, d.name]));
    const byDesign = new Map();
    const loose = [];
    items.forEach((it) => {
      if (!it.is_active && Number(it.quantity) <= 0) return;
      if (it.design_id) {
        const r = byDesign.get(it.design_id) || {
          key: `d${it.design_id}`, name: designName[it.design_id] || 'Unknown design', designId: it.design_id,
          qty: 0, prices: new Set(), retailNames: [],
        };
        r.qty += Math.max(0, Number(it.quantity) || 0);
        if (it.retail_price) r.prices.add(Number(it.retail_price));
        r.retailNames.push(it.name);
        byDesign.set(it.design_id, r);
      } else {
        loose.push({
          key: `i${it.item_id}`, name: it.name, itemId: it.item_id, qty: Math.max(0, Number(it.quantity) || 0),
          prices: new Set(it.retail_price ? [Number(it.retail_price)] : []), retailNames: [], unlinked: it.match_source !== 'none',
        });
      }
    });
      return [...byDesign.values(), ...loose].map((r) => ({ ...r, soldOnline30: r.designId ? (soldOnline[r.designId] || 0) : null }));
  }, [items, designs, soldOnline]);

  const counts = useMemo(() => ({
    suits: rows.reduce((t, r) => t + r.qty, 0),
    inStock: rows.filter((r) => r.qty > 0).length,
    out: rows.filter((r) => r.qty <= 0).length,
    low: rows.filter((r) => r.qty > 0 && r.qty <= LOW_STOCK).length,
  }), [rows]);

  const q = search.trim().toLowerCase();
  const visible = rows
    .filter((r) => filter === 'out' ? r.qty <= 0 : filter === 'low' ? r.qty > 0 && r.qty <= LOW_STOCK : filter === 'in' ? r.qty > 0 : true)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.retailNames.some((n) => n.toLowerCase().includes(q)))
    .sort((a, b) => {
      // Finished designs that still sell online first, then lowest stock.
      const urgency = (r) => (r.qty <= 0 ? 0 : r.qty <= LOW_STOCK ? 1 : 2);
      return urgency(a) - urgency(b) || (b.soldOnline30 || 0) - (a.soldOnline30 || 0) || a.qty - b.qty || a.name.localeCompare(b.name);
    });

  const unlinked = items.filter((it) => !it.design_id && it.match_source !== 'none' && (it.is_active || Number(it.quantity) > 0));
  const activeDesigns = designs.filter((d) => d.is_active);

  const cards = [
    { label: 'Suits in stock', value: counts.suits.toLocaleString(), sub: `${counts.inStock} designs available`, cls: 'bg-white border-gray-100', f: 'in' },
    { label: 'Out of stock', value: counts.out, sub: 'Finished designs', cls: counts.out ? 'bg-red-50/80 border-red-200' : 'bg-white border-gray-100', f: 'out' },
    { label: `Low stock (1-${LOW_STOCK})`, value: counts.low, sub: 'Finishing soon', cls: counts.low ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100', f: 'low' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-500">
          {lastSync
            ? <>Stock from the shop software · last updated <span className="font-semibold text-gray-700">{new Date(lastSync.synced_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></>
            : 'Stock has not been loaded from the shop software yet.'}
        </p>
        {isAdmin && (
          <>
            <input ref={fileRef} type="file" accept=".sqlite3,.sqlite,.db" className="hidden" onChange={handleFile} />
            <button
              type="button"
              disabled={syncing}
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-sm disabled:opacity-60 disabled:cursor-wait"
            >
              {syncing ? 'Updating...' : 'Update stock from shop file'}
            </button>
          </>
        )}
      </div>

      {syncMsg && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${syncMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {syncMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={() => setFilter(c.f)} className={`text-left p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow ${c.cls}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{c.label}</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.sub}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[['all', 'All'], ['out', 'Out of stock'], ['low', 'Low stock'], ['in', 'In stock']].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filter === k ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search design..."
            className="w-full md:max-w-xs px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                <th className="py-3 px-5">Design</th>
                <th className="py-3 px-5">Stock</th>
                <th className="py-3 px-5 text-right">Sold online (30 days)</th>
                <th className="py-3 px-5 text-right">Shop price</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr><td colSpan="4" className="py-10 text-center text-gray-400">Loading...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan="4" className="py-10 text-center text-gray-400">{rows.length ? 'Nothing for this filter.' : 'No stock yet. The admin can update it from the shop file.'}</td></tr>
              ) : visible.map((r) => (
                <tr key={r.key} className="border-b border-gray-50 hover:bg-gray-50/70">
                  <td className="py-3 px-5">
                    <p className="font-semibold text-gray-900">{r.name}</p>
                    {r.unlinked
                      ? <p className="text-[11px] text-orange-600">Not linked to a design</p>
                      : r.retailNames.length > 0 && <p className="text-[11px] text-gray-400 truncate max-w-[320px]">{r.retailNames.join(' · ')}</p>}
                  </td>
                  <td className="py-3 px-5"><StockBadge qty={r.qty} /></td>
                  <td className="py-3 px-5 text-right text-gray-700">
                    {r.soldOnline30 == null ? <span className="text-gray-300">-</span> : r.soldOnline30}
                    {r.qty <= 0 && r.soldOnline30 > 0 && <span className="block text-[11px] font-bold text-red-600">Restock</span>}
                  </td>
                  <td className="py-3 px-5 text-right text-gray-700">
                    {r.prices.size ? [...r.prices].sort((a, b) => a - b).map((p) => `PKR ${p.toLocaleString()}`).join(' / ') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && unlinked.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900">Link shop items to designs</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            These items from the shop software were not matched to a design automatically. Choose the design once; it is remembered for the next updates.
          </p>
          <div className="space-y-2">
            {unlinked.map((it) => (
              <div key={it.item_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2 border-b border-gray-50 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{it.name}</p>
                  <p className="text-[11px] text-gray-400">{Number(it.quantity) || 0} in stock</p>
                </div>
                <select
                  defaultValue=""
                  onChange={(e) => e.target.value && linkItem(it.item_id, e.target.value === 'none' ? null : Number(e.target.value))}
                  className="w-full sm:w-64 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">Choose design...</option>
                  <option value="none">Not a design (ignore)</option>
                  {activeDesigns.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
