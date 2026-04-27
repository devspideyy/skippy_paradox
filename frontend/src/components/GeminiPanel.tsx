import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Sparkles, Loader2, Trash2,
  RotateCcw, Plus, ChevronDown, Square, X,
} from 'lucide-react';
import { marked } from 'marked';
import { useTheme } from '../hooks/useTheme';
import { StoredFile } from '../services/storageService';
import { geminiKeyRotation } from '../services/geminiKeyRotation';

/* ── Types ─────────────────────────────────────────────────────────── */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
  timestamp: number;
}

interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface GeminiPanelProps {
  activeFile: StoredFile | null;
}

/* ── Constants ─────────────────────────────────────────────────────── */

const GEMINI_API_KEY_STORAGE = 'gemini-api-key';
const CONVERSATIONS_STORAGE = 'gemini-conversations';
const ACTIVE_CONV_STORAGE = 'gemini-active-conv';
const MAX_HISTORY_MESSAGES = 10;
const MAX_FILE_CONTEXT_CHARS = 12000;
const MAX_CONVERSATIONS = 20;

const QUICK_ACTIONS = [
  { label: 'Explain', prompt: 'Explain what this code does in plain English.' },
  { label: 'Fix bugs', prompt: 'Find and fix any bugs or issues in this code.' },
  { label: 'Optimize', prompt: 'Suggest performance optimizations for this code.' },
  { label: 'Add types', prompt: 'Add proper TypeScript types to this code.' },
];

/* ── Configure marked ──────────────────────────────────────────────── */

marked.setOptions({
  gfm: true,
  breaks: true,
});

/* ── Conversation persistence ──────────────────────────────────────── */

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_STORAGE, JSON.stringify(convs.slice(0, MAX_CONVERSATIONS)));
  } catch { /* quota exceeded — silently fail */ }
}

function loadActiveConvId(): string | null {
  return localStorage.getItem(ACTIVE_CONV_STORAGE);
}

function saveActiveConvId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_CONV_STORAGE, id);
  else localStorage.removeItem(ACTIVE_CONV_STORAGE);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createConversation(): Conversation {
  return {
    id: newId(),
    name: 'New chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/* ── Markdown renderer ─────────────────────────────────────────────── */

function RenderedMarkdown({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = React.useMemo(() => {
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }, [content]);

  useEffect(() => {
    if (!containerRef.current) return;
    const pres = containerRef.current.querySelectorAll('pre');
    pres.forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return;
      pre.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn absolute top-2 right-2 p-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-slate-400 hover:text-slate-200 text-[10px]';
      btn.textContent = 'Copy';
      btn.onclick = () => {
        const code = pre.querySelector('code')?.textContent || pre.textContent || '';
        navigator.clipboard.writeText(code);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      };
      pre.appendChild(btn);
    });

    const links = containerRef.current.querySelectorAll('a');
    links.forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="ai-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ── Message bubble ────────────────────────────────────────────────── */

function MessageBubble({ msg, isStreaming }: { msg: Message; isStreaming?: boolean }) {
  const { isDark } = useTheme();
  const isUser = msg.role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <div className="flex items-center gap-1.5 mb-0.5 mx-1">
          <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={7} className="text-white" />
          </div>
          <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AI</span>
        </div>
      )}
      <div
        className={`px-2.5 py-1.5 rounded-lg text-[12px] max-w-[92%] leading-relaxed overflow-hidden ${
          isUser
            ? 'bg-[#CAA4F7] text-[#1E1E2A] rounded-tr-sm'
            : isDark
              ? 'bg-[#232340] text-slate-200 rounded-tl-sm'
              : 'bg-white text-slate-800 border border-slate-200/60 rounded-tl-sm'
        }`}
      >
        {msg.loading && !msg.content ? (
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-purple-400" />
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Thinking...</span>
          </div>
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <>
            <RenderedMarkdown content={msg.content} />
            {isStreaming && (
              <span className="inline-block w-[2px] h-[14px] bg-purple-400 ml-0.5 align-middle animate-blink-cursor" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Conversation dropdown ─────────────────────────────────────────── */

function ConversationDropdown({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isDark,
}: {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
          isDark ? 'hover:bg-slate-700/50 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
        }`}
      >
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        <span>History</span>
      </button>

      {open && (
        <div
          className={`absolute top-full left-0 mt-1 w-56 rounded-lg shadow-xl border z-50 overflow-hidden ${
            isDark ? 'bg-[#1a1a2e] border-slate-700/50' : 'bg-white border-slate-200'
          }`}
        >
          <button
            onClick={() => { onNew(); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors ${
              isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'
            }`}
          >
            <Plus size={12} /> New chat
          </button>

          <div className={`border-t ${isDark ? 'border-slate-700/40' : 'border-slate-100'}`} />

          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {sorted.length === 0 && (
              <div className={`px-3 py-3 text-[10px] text-center ${textMuted}`}>No conversations yet</div>
            )}
            {sorted.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  conv.id === activeId
                    ? isDark ? 'bg-purple-500/10' : 'bg-purple-50'
                    : isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                }`}
                onClick={() => { onSelect(conv.id); setOpen(false); }}
              >
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] truncate ${
                    conv.id === activeId
                      ? 'text-purple-400 font-medium'
                      : isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {conv.name}
                  </div>
                  <div className={`text-[9px] ${textMuted}`}>
                    {conv.messages.length} msgs · {relativeTime(conv.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all ${textMuted} hover:text-red-400 hover:bg-red-500/10`}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main panel ────────────────────────────────────────────────────── */

export const GeminiPanel: React.FC<GeminiPanelProps> = ({ activeFile }) => {
  const { isDark } = useTheme();

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(loadActiveConvId);
  const [messages, setMessages] = useState<Message[]>([]);

  // UI state
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyStats, setKeyStats] = useState(geminiKeyRotation.getUsageStats());

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingMsgId = useRef<string | null>(null);

  /* ── Initialize conversation ───────────────────────────────────── */

  useEffect(() => {
    const convs = loadConversations();
    setConversations(convs);

    let id = loadActiveConvId();
    if (id && convs.find((c) => c.id === id)) {
      setMessages(convs.find((c) => c.id === id)!.messages);
    } else {
      const conv = createConversation();
      const updated = [conv, ...convs].slice(0, MAX_CONVERSATIONS);
      saveConversations(updated);
      saveActiveConvId(conv.id);
      setConversations(updated);
      setActiveConvId(conv.id);
      id = conv.id;
    }
    setActiveConvId(id);
  }, []);

  /* ── Persist messages on change ────────────────────────────────── */

  const persistConversation = useCallback((msgs: Message[]) => {
    if (!activeConvId) return;
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: msgs, updatedAt: Date.now() }
          : c
      );
      saveConversations(updated);
      return updated;
    });
  }, [activeConvId]);

  /* ── Auto-scroll ───────────────────────────────────────────────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Block wheel ───────────────────────────────────────────────── */

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const block = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', block, { passive: false });
    return () => el.removeEventListener('wheel', block);
  }, []);

  /* ── Build Gemini request ──────────────────────────────────────── */

  const buildContext = useCallback(() => {
    if (!activeFile) return '';
    const lang = activeFile.language || 'plaintext';
    const full = activeFile.content || '';
    const content = full.length > MAX_FILE_CONTEXT_CHARS
      ? `${full.slice(0, MAX_FILE_CONTEXT_CHARS)}\n\n[Truncated]`
      : full;
    return `\`\`\`${lang}\n// File: ${activeFile.name}\n${content}\n\`\`\``;
  }, [activeFile]);

  const buildContents = useCallback((userText: string) => {
    const history = messages
      .filter((m) => !m.loading && m.content.trim())
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
        parts: [{ text: m.content }],
      }));

    const context = buildContext();
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (context) {
      contents.push({
        role: 'user',
        parts: [{ text: `You are an expert coding assistant in CodeCollab. Use this file context when relevant:\n\n${context}` }],
      });
    }

    contents.push(...history);
    contents.push({ role: 'user', parts: [{ text: userText }] });
    return contents;
  }, [buildContext, messages]);

  /* ── Streaming send ────────────────────────────────────────────── */

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const currentKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || geminiKeyRotation.getCurrentKey();
    if (!currentKey) {
      const errMsg: Message = {
        id: newId(), role: 'assistant',
        content: 'No Gemini API key found. Add a key in settings to start chatting.',
        timestamp: Date.now(),
      };
      const next = [...messages, errMsg];
      setMessages(next);
      persistConversation(next);
      return;
    }

    const requestContents = buildContents(userText);

    const userMsg: Message = { id: newId(), role: 'user', content: userText, timestamp: Date.now() };
    const assistantMsg: Message = { id: newId(), role: 'assistant', content: '', loading: true, timestamp: Date.now() };

    streamingMsgId.current = assistantMsg.id;

    const withUserMsg = [...messages, userMsg, assistantMsg];
    setMessages(withUserMsg);
    setInput('');
    setIsLoading(true);

    // Auto-name conversation on first user message
    if (activeConvId) {
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === activeConvId);
        if (conv && conv.name === 'New chat' && conv.messages.length === 0) {
          const name = userText.slice(0, 40) + (userText.length > 40 ? '...' : '');
          const updated = prev.map((c) => c.id === activeConvId ? { ...c, name } : c);
          saveConversations(updated);
          return updated;
        }
        return prev;
      });
    }

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${currentKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: requestContents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              accumulated += text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: accumulated, loading: true } : m
                )
              );
            }
          } catch { /* skip malformed chunk */ }
        }
      }

      if (!localStorage.getItem(GEMINI_API_KEY_STORAGE)) {
        geminiKeyRotation.recordUsage();
        setKeyStats(geminiKeyRotation.getUsageStats());
      }

      setMessages((prev) => {
        const final = prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: accumulated || 'No response received.', loading: false }
            : m
        );
        persistConversation(final);
        return final;
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, loading: false } : m
          );
          persistConversation(final);
          return final;
        });
      } else {
        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${e.message}`, loading: false }
              : m
          );
          persistConversation(final);
          return final;
        });
      }
    } finally {
      setIsLoading(false);
      streamingMsgId.current = null;
      abortRef.current = null;
    }
  }, [isLoading, messages, buildContents, persistConversation, activeConvId]);

  /* ── Stop streaming ────────────────────────────────────────────── */

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ── Conversation management ───────────────────────────────────── */

  const switchConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveConvId(id);
    saveActiveConvId(id);
    setMessages(conv.messages);
  }, [conversations]);

  const startNewConversation = useCallback(() => {
    const conv = createConversation();
    const updated = [conv, ...conversations].slice(0, MAX_CONVERSATIONS);
    saveConversations(updated);
    saveActiveConvId(conv.id);
    setConversations(updated);
    setActiveConvId(conv.id);
    setMessages([]);
  }, [conversations]);

  const deleteConversation = useCallback((id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    saveConversations(updated);
    setConversations(updated);

    if (id === activeConvId) {
      if (updated.length > 0) {
        switchConversation(updated[0].id);
      } else {
        startNewConversation();
      }
    }
  }, [conversations, activeConvId, switchConversation, startNewConversation]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    persistConversation([]);
  }, [persistConversation]);

  /* ── Form handlers ─────────────────────────────────────────────── */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  /* ── Theme ─────────────────────────────────────────────────────── */

  const bg = isDark ? 'bg-[#1E1E2A]' : 'bg-[#F0F2F6]';
  const border = isDark ? 'border-slate-700/40' : 'border-slate-300/40';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark ? 'bg-[#232340] border-slate-600/40' : 'bg-white border-slate-300';

  return (
    <div className={`flex flex-col h-full w-full ${bg} overflow-hidden`}>
      {/* Header */}
      <div className={`flex flex-col px-3 py-2.5 border-b ${border} shrink-0`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={8} className="text-white" />
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>AI Assistant</span>
            {activeFile && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-200 text-slate-500'} truncate max-w-[80px]`}>
                {activeFile.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ConversationDropdown
              conversations={conversations}
              activeId={activeConvId || ''}
              onSelect={switchConversation}
              onNew={startNewConversation}
              onDelete={deleteConversation}
              isDark={isDark}
            />
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className={`p-1 rounded-md ${textMuted} hover:text-red-400 hover:bg-red-500/10 transition-colors`}
                title="Clear chat"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Model + key stats */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className={`flex items-center gap-1 text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono">gemini-2.0-flash</span>
          </div>

          {!localStorage.getItem(GEMINI_API_KEY_STORAGE) && geminiKeyRotation.hasKeys() && (
            <div className="flex items-center gap-1">
              {keyStats.map((stat) => (
                <span
                  key={stat.keyIndex}
                  className={`text-[8px] px-1 py-0.5 rounded font-mono ${
                    stat.isCurrent
                      ? 'bg-purple-500/15 text-purple-400'
                      : isDark ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  K{stat.keyIndex}:{stat.usage}
                </span>
              ))}
              <button
                onClick={() => { geminiKeyRotation.resetUsage(); setKeyStats(geminiKeyRotation.getUsageStats()); }}
                className={`p-0.5 rounded ${textMuted} hover:text-purple-400 transition-colors`}
                title="Reset key usage"
              >
                <RotateCcw size={9} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions — only when empty */}
      {messages.length === 0 && (
        <div className={`px-3 py-2 border-b ${border} shrink-0`}>
          <div className="flex flex-wrap gap-1">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                disabled={isLoading || !activeFile}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all active:scale-95 disabled:opacity-30 ${
                  isDark
                    ? 'bg-[#232340] hover:bg-[#2a2a50] text-slate-300 border border-slate-700/40'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
          {!activeFile && (
            <p className={`text-[9px] mt-1 ${textMuted} opacity-50`}>Open a file to use quick actions</p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto scrollbar-hide p-3 space-y-2.5"
        >
          {messages.length === 0 && (
            <div className={`flex flex-col items-center justify-center h-full ${textMuted}`}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/15 to-purple-600/15 flex items-center justify-center mb-2">
                <Sparkles size={16} className="text-purple-400" />
              </div>
              <p className="text-[11px] font-medium">Ask AI anything</p>
              <p className="text-[10px] mt-0.5 opacity-40">Analyze, fix, or improve your code</p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isStreaming={msg.loading && msg.id === streamingMsgId.current && msg.content.length > 0}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className={`p-2.5 border-t ${border} shrink-0`}>
        {isLoading && (
          <button
            onClick={stopStreaming}
            className={`w-full flex items-center justify-center gap-1.5 mb-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              isDark
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-red-50 text-red-500 hover:bg-red-100'
            }`}
          >
            <Square size={10} /> Stop generating
          </button>
        )}
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeFile ? `Ask about ${activeFile.name}...` : 'Ask AI...'}
            className={`w-full pl-3 pr-9 py-2 rounded-lg text-[12px] focus:outline-none transition-colors border ${inputBg} ${textPrimary} placeholder:text-slate-400/50 focus:ring-1 focus:ring-[#CAA4F7]/40 focus:border-[#CAA4F7]/40`}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
              !input.trim() || isLoading
                ? 'opacity-20 cursor-not-allowed'
                : 'text-[#CAA4F7] hover:bg-[#CAA4F7]/10'
            }`}
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </form>
      </div>
    </div>
  );
};
