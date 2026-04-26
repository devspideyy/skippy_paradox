/**
 * GeminiPanel — Gemini AI assistant panel for live code analysis.
 * Streams responses from the Gemini API via the backend proxy.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, X, Loader2, Copy, Check, Trash2, ChevronDown } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { StoredFile } from '../services/storageService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

interface GeminiPanelProps {
  activeFile: StoredFile | null;
  files: StoredFile[];
}

const GEMINI_API_KEY_STORAGE = 'gemini-api-key';

// Quick-action prompts
const QUICK_ACTIONS = [
  { label: 'Explain', prompt: 'Explain what this code does in plain English.' },
  { label: 'Fix bugs', prompt: 'Find and fix any bugs or issues in this code.' },
  { label: 'Optimise', prompt: 'Suggest performance optimisations for this code.' },
  { label: 'Add types', prompt: 'Add proper TypeScript types to this code.' },
  { label: 'Write tests', prompt: 'Write unit tests for this code.' },
  { label: 'Refactor', prompt: 'Refactor this code to be cleaner and more maintainable.' },
];

function CodeBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const { isDark } = useTheme();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative rounded-lg overflow-hidden my-2 ${isDark ? 'bg-[#0d0d1a]' : 'bg-slate-900'}`}>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-slate-300"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <pre className="p-3 pr-10 text-[11px] text-slate-200 overflow-x-auto custom-scrollbar leading-relaxed">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const { isDark } = useTheme();
  const isUser = msg.role === 'user';

  // Parse content into text and code blocks
  const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(msg.content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: msg.content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2].trim(), lang: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < msg.content.length) {
    parts.push({ type: 'text', content: msg.content.slice(lastIndex) });
  }

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      {!isUser && (
        <div className="flex items-center gap-1.5 mb-1.5 ml-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={10} className="text-white" />
          </div>
          <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gemini</span>
        </div>
      )}
      <div className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed ${
        isUser
          ? 'bg-[#CAA4F7] text-[#1E1E2A] rounded-tr-sm font-medium'
          : isDark
            ? 'bg-[#1a1a2e] text-slate-200 rounded-tl-sm border border-slate-700/40'
            : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200'
      }`}>
        {msg.loading ? (
          <div className="flex items-center gap-2">
            <Loader2 size={13} className="animate-spin text-purple-400" />
            <span className="text-slate-400 text-[11px]">Thinking…</span>
          </div>
        ) : (
          parts.map((part, i) =>
            part.type === 'code' ? (
              <CodeBlock key={i} content={part.content} />
            ) : (
              <span key={i} className="whitespace-pre-wrap">{part.content}</span>
            )
          )
        )}
      </div>
    </div>
  );
}

export const GeminiPanel: React.FC<GeminiPanelProps> = ({ activeFile, files }) => {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_API_KEY_STORAGE) || '');
  const [showKeyInput, setShowKeyInput] = useState(!localStorage.getItem(GEMINI_API_KEY_STORAGE));
  const [keyDraft, setKeyDraft] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!isLoading) scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 80);
  };

  const buildContext = useCallback(() => {
    if (!activeFile) return '';
    const lang = activeFile.language || 'plaintext';
    return `\`\`\`${lang}\n// File: ${activeFile.name}\n${activeFile.content}\n\`\`\``;
  }, [activeFile]);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading || !apiKey) return;

    const context = buildContext();
    const fullPrompt = context
      ? `Here is the current file (${activeFile?.name}):\n\n${context}\n\n${userText}`
      : userText;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
    };
    const loadingMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      loading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response received.';

      setMessages(prev =>
        prev.map(m => m.id === loadingMsg.id ? { ...m, content: text, loading: false } : m)
      );
    } catch (e: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, content: `Error: ${e.message}`, loading: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, apiKey, buildContext, activeFile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSaveKey = () => {
    if (!keyDraft.trim()) return;
    localStorage.setItem(GEMINI_API_KEY_STORAGE, keyDraft.trim());
    setApiKey(keyDraft.trim());
    setShowKeyInput(false);
    setKeyDraft('');
  };

  const handleClearKey = () => {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    setApiKey('');
    setShowKeyInput(true);
  };

  const bg = isDark ? 'bg-[#13131f]' : 'bg-[#F0F2F6]';
  const border = isDark ? 'border-slate-700/50' : 'border-slate-300/50';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark ? 'bg-[#1e1e2e] border-slate-600/50' : 'bg-white border-slate-300';

  return (
    <div className={`flex flex-col h-full ${bg} border-l ${border}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b ${border} shrink-0`}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Gemini AI</span>
          {activeFile && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-slate-700/60 text-slate-400' : 'bg-slate-200 text-slate-500'} truncate max-w-[100px]`}>
              {activeFile.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className={`p-1.5 rounded-lg ${textMuted} hover:text-red-400 hover:bg-red-500/10 transition-colors`}
              title="Clear chat"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={() => setShowKeyInput(v => !v)}
            className={`p-1.5 rounded-lg ${textMuted} hover:text-purple-400 hover:bg-purple-500/10 transition-colors`}
            title={apiKey ? 'Change API key' : 'Set API key'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
            </svg>
          </button>
        </div>
      </div>

      {/* API Key setup */}
      {showKeyInput && (
        <div className={`px-3 py-3 border-b ${border} shrink-0 space-y-2`}>
          <p className={`text-[11px] ${textMuted}`}>
            Enter your{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
              className="text-purple-400 hover:underline">Gemini API key</a>
            {' '}to enable AI assistance.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyDraft}
              onChange={e => setKeyDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              placeholder="AIza..."
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] border ${inputBg} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${isDark ? 'text-white' : 'text-slate-900'} placeholder:text-slate-500`}
            />
            <button
              onClick={handleSaveKey}
              disabled={!keyDraft.trim()}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-colors disabled:opacity-40"
            >
              Save
            </button>
          </div>
          {apiKey && (
            <button onClick={handleClearKey} className="text-[10px] text-red-400 hover:underline">
              Remove saved key
            </button>
          )}
        </div>
      )}

      {/* Quick actions */}
      {!showKeyInput && apiKey && messages.length === 0 && (
        <div className={`px-3 py-3 border-b ${border} shrink-0`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted} mb-2`}>Quick actions</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                disabled={isLoading || !activeFile}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-95 disabled:opacity-40 ${
                  isDark
                    ? 'bg-[#1e1e2e] hover:bg-[#2a2a40] text-slate-300 border border-slate-700/50 hover:border-purple-500/40'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-purple-400'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
          {!activeFile && (
            <p className={`text-[10px] mt-2 ${textMuted} opacity-60`}>Open a file to use quick actions.</p>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar relative"
      >
        {messages.length === 0 && !showKeyInput && apiKey && (
          <div className={`flex flex-col items-center justify-center h-full py-8 ${textMuted} text-center`}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-3">
              <Sparkles size={22} className="text-purple-400" />
            </div>
            <p className="text-xs font-semibold mb-1">Ask Gemini anything</p>
            <p className="text-[10px] opacity-60 max-w-[180px]">
              Analyse, fix, explain, or improve your code with AI.
            </p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-4 w-7 h-7 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg transition-all animate-fade-in-up z-10"
        >
          <ChevronDown size={14} />
        </button>
      )}

      {/* Input */}
      {!showKeyInput && apiKey && (
        <div className={`px-3 py-2.5 border-t ${border} shrink-0`}>
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={activeFile ? `Ask about ${activeFile.name}…` : 'Ask Gemini…'}
              rows={1}
              className={`w-full pl-3 pr-10 py-2 rounded-xl text-[12px] resize-none border ${inputBg} ${isDark ? 'text-white' : 'text-slate-900'} placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-colors custom-scrollbar`}
              style={{ minHeight: '36px', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`absolute right-2 bottom-2 p-1.5 rounded-lg transition-all active:scale-90 ${
                !input.trim() || isLoading
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-purple-400 hover:bg-purple-500/15'
              }`}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </form>
          <p className={`text-[9px] mt-1 ${textMuted} opacity-40 text-center`}>
            Shift+Enter for new line · Enter to send
          </p>
        </div>
      )}
    </div>
  );
};
