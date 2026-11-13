// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

// "Ask AI" page, laid out like ChatGPT / Claude: saved chats on the left, the chat on the right.
// Questions go to the Edge Function `ai-assistant`: the server calculates the numbers from the
// database and Gemini only explains them. Staff never get cost / profit.
// Chats are saved in public.ai_conversations (each user sees only their own chats).

const ADMIN_SUGGESTIONS = [
  'Is mahine ki sale pichle mahine ke muqable mein kaisi hai?',
  'Kaun se designs sab se zyada profit de rahe hain?',
  'Kaun se designs slow chal rahe hain?',
  'Agle mahine ke liye kaun se designs aur sizes zyada mangwane chahiyen?',
  'Hafte ka kaun sa din sab se acha jata hai?',
  'Sab se zyada khareedari kin customers ne ki hai?',
];
const STAFF_SUGGESTIONS = [
  'Is mahine ki sale pichle mahine ke muqable mein kaisi hai?',
  'Pichle 30 din mein kaun se designs sab se zyada bike?',
  'Kaun se designs slow chal rahe hain?',
  'Kaun sa size sab se zyada bikta hai?',
  'Kitne COD payments pending hain?',
  'Hafte ka kaun sa din sab se acha jata hai?',
];

// Very small markdown: **bold**, bullet lines (- or *), numbered lines, paragraphs.
function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>
  );
}
function AnswerText({ text }) {
  const lines = String(text).split('\n');
  const blocks = [];
  let list = null;
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (!list) { list = []; blocks.push({ type: 'list', items: list, key: i }); }
      list.push(bullet[1]);
      return;
    }
    list = null;
    if (line.trim() === '') return;
    blocks.push({ type: 'p', text: line.replace(/^#+\s*/, ''), key: i });
  });
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b) =>
        b.type === 'list' ? (
          <ul key={b.key} className="list-disc pl-5 space-y-1">
            {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
          </ul>
        ) : (
          <p key={b.key}>{renderInline(b.text)}</p>
        )
      )}
    </div>
  );
}

export const SPARKLES_PATH = 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z';

const STEPS_MATH = ['Calculating...', 'Checking the numbers...', 'Writing the answer...'];
const STEPS_DATA = ['Reading your sales data...', 'Calculating...', 'Thinking...', 'Writing the answer...'];

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AskAIPanel({ isAdmin }) {
  const [chats, setChats] = useState([]);           // [{ id, title, updated_at }]
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);     // [{ role, text, sources?, error? }]
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [listOpen, setListOpen] = useState(false);  // mobile: chat list drawer
  const [showMemory, setShowMemory] = useState(false);
  const [memory, setMemory] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  // ---------- saved chats ----------
  const loadChats = async () => {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) console.error('Could not load chats:', error);
    setChats(data || []);
    setChatsLoading(false);
  };
  useEffect(() => { loadChats(); }, []);

  const openChat = async (id) => {
    if (busy) return;
    setActiveId(id);
    setListOpen(false);
    const { data, error } = await supabase.from('ai_conversations').select('messages').eq('id', id).maybeSingle();
    if (error) console.error('Could not open chat:', error);
    setMessages(Array.isArray(data?.messages) ? data.messages : []);
  };

  const newChat = () => {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setInput('');
    setListOpen(false);
  };

  const startRename = (c) => { setRenamingId(c.id); setRenameText(c.title || ''); };
  const saveRename = async () => {
    const title = renameText.trim().slice(0, 80);
    const id = renamingId;
    setRenamingId(null);
    if (!title || !id) return;
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    const { error } = await supabase.from('ai_conversations').update({ title }).eq('id', id);
    if (error) { window.alert('Could not rename this chat.'); loadChats(); }
  };

  const deleteChat = async (c) => {
    if (!window.confirm(`Delete the chat "${c.title || 'Untitled'}"?`)) return;
    const { error } = await supabase.from('ai_conversations').delete().eq('id', c.id);
    if (error) return window.alert('Could not delete this chat.');
    setChats((prev) => prev.filter((x) => x.id !== c.id));
    if (activeId === c.id) newChat();
  };

  const saveChat = async (id, msgs, title) => {
    const clean = msgs.filter((m) => !m.error).slice(-60);
    if (id) {
      const { error } = await supabase.from('ai_conversations')
        .update({ messages: clean, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) console.error('Could not save chat:', error);
      setChats((prev) => {
        const row = prev.find((c) => c.id === id) || { id, title };
        return [{ ...row, updated_at: new Date().toISOString() }, ...prev.filter((c) => c.id !== id)];
      });
      return id;
    }
    const { data, error } = await supabase.from('ai_conversations')
      .insert({ title, messages: clean }).select('id, title, updated_at').single();
    if (error) { console.error('Could not create chat:', error); return null; }
    setChats((prev) => [data, ...prev]);
    return data.id;
  };

  // ---------- memory (admin only, kept out of the chat view) ----------
  const loadMemory = async () => {
    const { data, error } = await supabase.from('ai_memory').select('id, fact').order('id', { ascending: true });
    if (!error) setMemory(data || []);
  };
  useEffect(() => { if (showMemory) loadMemory(); }, [showMemory]);
  const forgetFact = async (id) => {
    if (!window.confirm('Remove this fact from the AI memory?')) return;
    const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { action: 'forget_memory', id } });
    if (error || !data?.ok) return window.alert(data?.error || 'Could not remove it.');
    loadMemory();
  };

  // ---------- ask ----------
  const ask = async (questionText) => {
    const question = String(questionText ?? input).trim();
    if (!question || busy) return;
    const history = messages.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, text: m.text }));
    const withQuestion = [...messages, { role: 'user', text: question }];
    setMessages(withQuestion);
    setInput('');
    setBusy(true);

    const steps = /\d\s*[-+*/x×÷%]\s*\d|kitna|kitne|calculate|hisaab|percent|%/i.test(question) ? STEPS_MATH : STEPS_DATA;
    let stepIndex = 0;
    setStatus(steps[0]);
    const timer = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setStatus(steps[stepIndex]);
    }, 1500);

    let reply;
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { question, history } });
      if (error || !data) reply = { role: 'assistant', text: 'Could not reach the AI service. Please try again.', error: true };
      else if (!data.ok) reply = { role: 'assistant', text: data.error || 'Something went wrong.', error: true };
      else {
        reply = { role: 'assistant', text: data.answer, sources: data.sources || [] };
        if (data.memoryChanged && showMemory) loadMemory();
      }
    } catch {
      reply = { role: 'assistant', text: 'Could not reach the AI service. Please try again.', error: true };
    } finally {
      clearInterval(timer);
      setBusy(false);
    }

    const finalMessages = [...withQuestion, reply];
    setMessages(finalMessages);
    if (!reply.error) {
      const id = await saveChat(activeId, finalMessages, question.slice(0, 60));
      if (id && !activeId) setActiveId(id);
    }
  };

  const suggestions = isAdmin ? ADMIN_SUGGESTIONS : STAFF_SUGGESTIONS;

  // ---------- chat list (left column) ----------
  const chatList = (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <button
          type="button"
          onClick={newChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
          New chat
        </button>
      </div>
      <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Recent chats</p>
      <div className="app-scroll flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {chatsLoading ? (
          <p className="px-3 py-2 text-sm text-gray-400">Loading...</p>
        ) : chats.length === 0 ? (
          <p className="px-3 py-2 text-sm text-gray-400">No chats yet.</p>
        ) : chats.map((c) => (
          <div
            key={c.id}
            className={`group/chat flex items-center gap-1 rounded-lg ${activeId === c.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
          >
            {renamingId === c.id ? (
              <input
                autoFocus
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
                onBlur={saveRename}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenamingId(null); }}
                className="flex-1 min-w-0 m-1 px-2 py-1.5 text-sm bg-white border border-purple-300 rounded-md outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => openChat(c.id)}
                className="flex-1 min-w-0 text-left px-3 py-2"
              >
                <span className={`block truncate text-sm ${activeId === c.id ? 'font-semibold text-purple-700' : 'text-gray-700'}`}>{c.title || 'Untitled'}</span>
                <span className="block text-[11px] text-gray-400">{timeLabel(c.updated_at)}</span>
              </button>
            )}
            {renamingId !== c.id && (
              <div className="flex items-center pr-1 opacity-100 md:opacity-0 md:group-hover/chat:opacity-100 transition-opacity">
                <button type="button" title="Rename" onClick={() => startRename(c)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536 9 17l.464-3.536z"></path></svg>
                </button>
                <button type="button" title="Delete" onClick={() => deleteChat(c)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="border-t border-gray-100 p-2">
          <button
            type="button"
            onClick={() => setShowMemory((v) => !v)}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          >
            {showMemory ? 'Hide AI memory' : 'Manage AI memory'}
          </button>
          {showMemory && (
            <div className="app-scroll max-h-48 overflow-y-auto px-3 pb-2 space-y-1.5">
              {memory.length === 0 ? (
                <p className="text-xs text-gray-400">Nothing saved. Tell the AI a fact and say "yaad rakho".</p>
              ) : memory.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-2 text-xs text-gray-600">
                  <span>{f.fact}</span>
                  <button type="button" onClick={() => forgetFact(f.id)} className="shrink-0 font-bold text-red-600 hover:text-red-700">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const activeTitle = chats.find((c) => c.id === activeId)?.title;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex h-[calc(100vh-13rem)] min-h-[520px] overflow-hidden relative">
      {/* Left: saved chats (desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-gray-100 bg-gray-50/50 flex-col">{chatList}</aside>

      {/* Left: saved chats (mobile drawer) */}
      {listOpen && (
        <div className="md:hidden absolute inset-0 z-20 flex">
          <div className="w-72 max-w-[85%] bg-white border-r border-gray-100 shadow-xl flex flex-col">{chatList}</div>
          <button type="button" aria-label="Close chats" onClick={() => setListOpen(false)} className="flex-1 bg-gray-900/30" />
        </div>
      )}

      {/* Right: the chat */}
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <button type="button" onClick={() => setListOpen(true)} className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-50" aria-label="Chats">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={SPARKLES_PATH}></path></svg>
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 truncate">{activeTitle || 'AI Business Assistant'}</h2>
            <p className="text-xs text-gray-500 truncate">
              English, Urdu or Roman Urdu{!isAdmin && ' · Cost and profit are only for the admin'}
            </p>
          </div>
        </div>

        <div className="app-scroll flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={SPARKLES_PATH}></path></svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">How can I help today?</p>
                <p className="text-sm text-gray-500 mt-1">Ask about sales, designs, sizes, customers, Khata or anything else.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-md bg-purple-600 text-white px-4 py-2.5 text-sm whitespace-pre-wrap'
                    : m.error
                      ? 'max-w-[85%] rounded-2xl rounded-bl-md bg-red-50 text-red-700 px-4 py-2.5 text-sm'
                      : 'max-w-[90%] rounded-2xl rounded-bl-md bg-gray-50 text-gray-800 px-4 py-3'
                }
              >
                {m.role === 'assistant' && !m.error ? <AnswerText text={m.text} /> : m.text}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                    <span className="font-semibold">Web sources: </span>
                    {m.sources.map((s, j) => (
                      <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline mr-2">{s.title}</a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-gray-50 text-gray-500 px-4 py-2.5 text-sm flex items-center gap-2">
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin"></span>
                {status}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="border-t border-gray-100 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="Message the AI assistant..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-600"
          />
          <button type="submit" disabled={busy || !input.trim()} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl disabled:opacity-50">
            Ask
          </button>
        </form>
        <p className="px-5 pb-3 text-[11px] text-gray-400 hidden sm:block">
          AI can make mistakes. Shop numbers are calculated from the database; general answers may be out of date.
        </p>
      </section>
    </div>
  );
}