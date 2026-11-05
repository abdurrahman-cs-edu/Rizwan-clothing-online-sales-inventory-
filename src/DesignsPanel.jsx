// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// ---------- Live name-suggestion helpers (same idea as the server check) ----------
const normLower = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const similarKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

// Admin "Designs" panel.
// Reads the designs table directly (public SELECT policy) and writes ONLY
// through the PIN-protected Edge Function actions:
// insert_design, update_design, set_design_active.
export default function DesignsPanel({ requestActionPin }) {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [fabric, setFabric] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchDesigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('designs')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error('Error fetching designs:', error);
      window.alert('Failed to load designs: ' + error.message);
      setDesigns([]);
    } else {
      setDesigns(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDesigns();
  }, []);

  // Calls the Edge Function and ALWAYS returns the server's JSON body,
  // even for 400/409 responses (the server sends useful messages there).
  const callDesignAction = async (action, payload, label) => {
    const pin = await requestActionPin(label);
    if (!pin) return { ok: false, cancelled: true };

    const { data, error } = await supabase.functions.invoke('protected-mutation', {
      body: { action, pin, ...payload }
    });

    let result = data;
    if (error) {
      result = null;
      try {
        if (typeof error.context?.json === 'function') {
          result = await error.context.json();
        }
      } catch {
        result = null;
      }
      if (!result) return { ok: false, error: 'Could not reach the server. Please check the Edge Function.' };
    }

    if (result && result.ok === false && result.error === 'Incorrect PIN.') {
      sessionStorage.removeItem('rizwan_action_pin_v2');
    }
    return result || { ok: false, error: 'Unexpected response.' };
  };

  const openAddForm = () => {
    setEditingId(null);
    setName('');
    setFabric('');
    setPrice('');
    setCost('');
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (d) => {
    setEditingId(d.id);
    setName(d.name || '');
    setFabric(d.fabric || '');
    setPrice(d.price != null ? String(d.price) : '');
    setCost(d.cost != null ? String(d.cost) : '');
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setFormError('');
  };

  // ---------- Live suggestions while typing the design name ----------
  const typedLower = normLower(name);
  const typedKey = similarKey(name);
  let nameMatches = [];
  if (formOpen && typedKey.length >= 2) {
    nameMatches = designs
      .filter((d) => d.id !== editingId)
      .map((d) => {
        const k = similarKey(d.name);
        let type = null;
        if (normLower(d.name) === typedLower) type = 'same';
        else if (k === typedKey) type = 'similar';
        else if (k.includes(typedKey)) type = 'similar';
        else if (Math.min(k.length, typedKey.length) >= 5 && editDistance(k, typedKey) <= 1) type = 'similar';
        return type ? { ...d, matchType: type } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.matchType === 'same' ? -1 : 0) - (b.matchType === 'same' ? -1 : 0))
      .slice(0, 6);
  }
  const exactMatch = nameMatches.find((m) => m.matchType === 'same');

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) return setFormError('Design name is required.');

    const sameName = designs.find(
      (d) => d.id !== editingId && normLower(d.name) === normLower(cleanName)
    );
    if (sameName) {
      return setFormError(
        sameName.is_active
          ? `"${sameName.name}" already exists. Use a different name or edit the existing design.`
          : `"${sameName.name}" already exists but is hidden. Do not create a new one: tick "Show hidden designs" in the list and click Unhide.`
      );
    }

    const priceNum = Number(price);
    if (price === '' || !Number.isFinite(priceNum) || priceNum < 0) {
      return setFormError('Enter a valid price (number).');
    }
    if (cost !== '' && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) {
      return setFormError('Cost must be a valid number (or leave it empty).');
    }

    setSaving(true);
    setFormError('');

    const row = {
      name: cleanName,
      fabric: fabric.trim(),
      price: priceNum,
      cost: cost === '' ? null : Number(cost)
    };

    try {
      const send = (confirmSimilar) =>
        editingId
          ? callDesignAction(
              'update_design',
              { id: editingId, payload: row, confirm_similar: confirmSimilar },
              'save this design'
            )
          : callDesignAction(
              'insert_design',
              { row, confirm_similar: confirmSimilar },
              'add this design'
            );

      let result = await send(false);
      if (result.cancelled) return;

      if (!result.ok && result.code === 'similar_name') {
        const proceed = window.confirm(
          `A similar design name already exists:\n\n${(result.similar || []).join('\n')}\n\nIs this really a different design? Save anyway?`
        );
        if (!proceed) return;
        result = await send(true);
        if (result.cancelled) return;
      }

      if (!result.ok) {
        setFormError(result.error || 'Could not save the design.');
        return;
      }

      setFormOpen(false);
      setEditingId(null);
      await fetchDesigns();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (d) => {
    const makeActive = !d.is_active;
    const msg = makeActive
      ? `Show "${d.name}" again?`
      : `Hide "${d.name}"? (Old sales stay valid. Designs are never deleted.)`;
    if (!window.confirm(msg)) return;

    const result = await callDesignAction(
      'set_design_active',
      { id: d.id, is_active: makeActive },
      makeActive ? 'unhide this design' : 'hide this design'
    );
    if (result.cancelled) return;
    if (!result.ok) {
      window.alert(result.error || 'Could not update the design.');
      return;
    }
    await fetchDesigns();
  };

  const query = search.trim().toLowerCase();
  const visibleDesigns = designs.filter((d) => {
    if (!showHidden && !d.is_active) return false;
    if (!query) return true;
    return (
      (d.name || '').toLowerCase().includes(query) ||
      (d.fabric || '').toLowerCase().includes(query)
    );
  });

  const activeCount = designs.filter((d) => d.is_active).length;
  const hiddenCount = designs.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Designs</p>
          <p className="text-3xl font-black text-gray-900 mt-2">{activeCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hidden Designs</p>
          <p className="text-3xl font-black text-gray-900 mt-2">{hiddenCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">New designs can only be added here.</p>
          <button
            type="button"
            onClick={openAddForm}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors shrink-0"
          >
            + Add Design
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search design or fabric..."
            className="w-full sm:max-w-xs px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-600"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Show hidden designs
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                <th className="py-3 px-5">Design</th>
                <th className="py-3 px-5">Fabric</th>
                <th className="py-3 px-5 text-right">Price (PKR)</th>
                <th className="py-3 px-5 text-right">Cost (PKR)</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-gray-400">Loading...</td>
                </tr>
              ) : visibleDesigns.length > 0 ? (
                visibleDesigns.map((d) => (
                  <tr key={d.id} className={`border-b border-gray-50 hover:bg-gray-50/70 ${d.is_active ? '' : 'opacity-60'}`}>
                    <td className="py-3 px-5 font-bold text-blue-600">{d.name}</td>
                    <td className="py-3 px-5 text-gray-700">{d.fabric || <span className="text-gray-300">-</span>}</td>
                    <td className="py-3 px-5 text-right font-semibold text-gray-900">{Number(d.price).toLocaleString()}</td>
                    <td className="py-3 px-5 text-right text-gray-700">
                      {d.cost != null ? Number(d.cost).toLocaleString() : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${d.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {d.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(d)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${d.is_active ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}
                        >
                          {d.is_active ? 'Hide' : 'Unhide'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-gray-400">
                    {designs.length === 0
                      ? 'No designs yet. Click "+ Add Design" to add your first design.'
                      : 'No designs found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Design' : 'Add Design'}</h2>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Design Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFormError(''); }}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none"
                  placeholder="e.g. Florence"
                />

                {nameMatches.length > 0 && (
                  <div
                    className={`mt-2 rounded-lg border p-3 text-sm ${
                      exactMatch ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <p className={`text-xs font-bold mb-2 ${exactMatch ? 'text-red-700' : 'text-amber-700'}`}>
                      {exactMatch
                        ? 'This name already exists. Do not create a duplicate:'
                        : 'Similar names already exist:'}
                    </p>
                    <ul className="space-y-1">
                      {nameMatches.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-800">{m.name}</span>
                          <span className="text-xs text-gray-500">
                            {Number(m.price).toLocaleString()} PKR
                            {m.fabric ? ` | ${m.fabric}` : ''}
                            {m.is_active ? '' : ' | Hidden'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {exactMatch && !exactMatch.is_active && (
                      <p className="text-xs text-red-700 mt-2">
                        This design is hidden. Tick "Show hidden designs" in the list and click Unhide.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fabric</label>
                <input
                  type="text"
                  value={fabric}
                  onChange={(e) => setFabric(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none"
                  placeholder="e.g. Lawn"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (PKR) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); setFormError(''); }}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none"
                    placeholder="8800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost per suit (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none"
                    placeholder="optional"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-sm font-semibold text-red-600">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-wait"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Design' : 'Save Design'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}