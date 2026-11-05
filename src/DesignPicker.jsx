// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

// Design picker for the Order and Khata forms (Step 13b).
// - Shows ONLY active designs from the admin "Designs" list.
// - Typing filters the list; an unknown name shows "No items found".
// - The form cannot be submitted until a design from the list is chosen
//   (uses the browser's built-in form validation via setCustomValidity).
// - Choosing a design calls onSelect(design) so the form can fill the price.
// - When editing an old order, the name that was already saved is allowed,
//   so old orders can still be opened and saved.

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Small shared cache so several pickers on one form load the list only once.
let cachedDesigns = null;
let cachedAt = 0;
const CACHE_MS = 30 * 1000;

async function loadActiveDesigns() {
  if (cachedDesigns && Date.now() - cachedAt < CACHE_MS) return cachedDesigns;
  const { data, error } = await supabase
    .from('designs')
    .select('id, name, price, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  cachedDesigns = data || [];
  cachedAt = Date.now();
  return cachedDesigns;
}

export default function DesignPicker({ value, onType, onSelect, placeholder = 'Type to search designs', className = '' }) {
  const [designs, setDesigns] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // The name this field had when it was opened (an old order being edited).
  const [initialValue] = useState(value || '');
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadActiveDesigns()
      .then((list) => {
        if (!alive) return;
        setDesigns(list);
        setLoaded(true);
      })
      .catch((err) => {
        if (!alive) return;
        console.error('Error loading designs:', err);
        setLoadError('Could not load the design list. Please refresh the page.');
        setLoaded(true);
      });
    return () => { alive = false; };
  }, []);

  // Close the list when clicking outside.
  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typed = norm(value);
  const exactMatch = designs.find((d) => norm(d.name) === typed);
  const keepsOldName = !!initialValue && norm(initialValue) === typed && !exactMatch;
  const isValid = !!typed && (!!exactMatch || keepsOldName);
  const matches = designs.filter((d) => !typed || norm(d.name).includes(typed));

  // Block form submit until a valid design is chosen.
  useEffect(() => {
    if (!inputRef.current) return;
    let message = '';
    if (loadError) message = loadError;
    else if (typed && loaded && !isValid) message = 'Please choose a design from the list.';
    inputRef.current.setCustomValidity(message);
  }, [typed, isValid, loaded, loadError]);

  const choose = (design) => {
    onSelect(design);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open && matches[highlight]) {
      e.preventDefault();
      choose(matches[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showError = typed && loaded && !isValid && !open;

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        required
        value={value}
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={`${className} ${showError ? '!border-red-400' : ''}`}
        placeholder={placeholder}
      />

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {!loaded ? (
            <div className="px-3 py-2 text-sm text-gray-400">Loading designs...</div>
          ) : loadError ? (
            <div className="px-3 py-2 text-sm text-red-600">{loadError}</div>
          ) : matches.length > 0 ? (
            matches.map((d, i) => (
              <button
                type="button"
                key={d.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(d)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 ${i === highlight ? 'bg-purple-50' : 'bg-white'}`}
              >
                <span className="font-medium text-gray-800">{d.name}</span>
                <span className="text-xs text-gray-500 shrink-0">PKR {Number(d.price || 0).toLocaleString()}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No items found</div>
          )}
        </div>
      )}

      {showError && (
        <p className="mt-1 text-xs font-semibold text-red-600">Please choose a design from the list.</p>
      )}
      {keepsOldName && !open && (
        <p className="mt-1 text-xs text-amber-600">Old name from this order. Choose a design from the list to correct it.</p>
      )}
    </div>
  );
}
