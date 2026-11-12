// @ts-nocheck
import React, { useState } from 'react';
import { supabase } from './supabaseClient';

// ---------------------------------------------------------------------------
// Demo login shown on the login page (for university / CV visitors).
// This is the STAFF account: it cannot see cost, profit, Charts & Reports or
// Designs, and every change still needs the action PIN.
// Write the staff password below yourself (do not share it in chat).
// Leave DEMO_PASSWORD empty ('') to hide the demo box.
// ---------------------------------------------------------------------------
const DEMO_EMAIL = 'user@rcs.com';
const DEMO_PASSWORD = 'user123';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message);
    }
    setBusy(false);
  };

  const useDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#f5f6fb] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-xl flex items-center justify-center shadow-lg">R</div>
          <div className="leading-tight">
            <div className="font-black tracking-[0.2em] text-gray-900">RIZWAN</div>
            <div className="text-xs tracking-[0.3em] text-gray-500">CLOTHING</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-black text-gray-900">Sign in</h1>
          <p className="text-sm text-gray-500 mt-1">Online sales, Khata and analytics.</p>

          {DEMO_PASSWORD && (
            <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-700">Demo access</p>
              <p className="text-sm text-gray-700 mt-1">
                Email: <span className="font-semibold">{DEMO_EMAIL}</span><br />
                Password: <span className="font-semibold">{DEMO_PASSWORD}</span>
              </p>
              <button type="button" onClick={useDemo} className="mt-2 text-sm font-bold text-purple-700 hover:text-purple-800">
                Fill demo login →
              </button>
            </div>
          )}

          <form onSubmit={signIn} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none"
              />
            </div>

            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-wait"
            >
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} Rizwan Clothing</p>
      </div>
    </div>
  );
}
