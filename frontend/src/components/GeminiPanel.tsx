/**
 * GeminiPanel — Gemini AI assistant panel for live code analysis.
 * Redesigned to match ChatPanel style with clean scrolling.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Loader2, Copy, Check, Trash2, RotateCcw } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { StoredFile } from '../services/storageService';
import { geminiKeyRotation } from '../services/geminiKeyRotation';
import BorderGlow from './BorderGlow';
import DotField from './DotField';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

interface GeminiPanelProps {
  activeFile: StoredFile | null;
}

const GEMINI_API_KEY_STORAGE = 'gemini-api-key';

// Quick-action prompts
const QUICK_ACTIONS = [
  { label: 'Explain', prompt: 'Explain what this code does in plain English.' },
  { label: 'Fix bugs', prompt: 'Find and fix any bugs or issues in this code.' },
  { label: 'Optimize', prompt: 'Suggest performance optimizations for this code.' },
  { label: 'Add types', prompt: 'Add proper TypeScript types to this code.' },
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

  const selfBubble = 'bg-[#CAA4F7] text-[#1E1E2A]';
  const otherBubble = isDark
    ? 'bg-[#232340] text-slate-200'
    : 'bg-white text-slate-800 border border-slate-200/80';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <div className="flex items-center gap-1.5 mb-1 mx-1">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={8} className="text-white" />
          </div>
          <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AI</span>
        </div>
      )}
      <div className={`px-3 py-2 rounded-lg text-[12px] max-w-[92%] leading-relaxed ${
        isUser
          ? `${selfBubble} rounded-tr-sm`
          : `${otherBubble} rounded-tl-sm`
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

export const GeminiPanel: React.FC<GeminiPanelProps> = ({ activeFile }) => {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyStats, setKeyStats] = useState(geminiKeyRotation.getUsageStats());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const buildContext = useCallback(() => {
    if (!activeFile) return '';
    const lang = activeFile.language || 'plaintext';
    return `\`\`\`${lang}\n// File: ${activeFile.name}\n${activeFile.content}\n\`\`\``;
  }, [activeFile]);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const currentKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || geminiKeyRotation.getCurrentKey();
    if (!currentKey) return;

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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${currentKey}`,
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

      if (!localStorage.getItem(GEMINI_API_KEY_STORAGE)) {
        geminiKeyRotation.recordUsage();
        setKeyStats(geminiKeyRotation.getUsageStats());
      }

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
  }, [isLoading, buildContext, activeFile]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const panelBg = isDark ? 'bg-[#1E1E2A]' : 'bg-[#F0F2F6]';
  const borderColor = isDark ? 'border-slate-700/50' : 'border-slate-300/50';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark ? 'bg-[#232340] border-slate-600/50' : 'bg-white border-slate-300';

  return (
    <BorderGlow
      backgroundColor={isDark ? '#1E1E2A' : '#F0F2F6'}
      colors={['#CAA4F7', '#9B6DD7', '#38bdf8']}
      borderRadius={0}
      glowRadius={30}
      glowIntensity={0.8}
      glowColor="280 60 85"
      fillOpacity={0.2}
      className="h-full w-full"
    >
      <div className={`flex flex-col h-full w-full ${panelBg} relative overflow-hidden`}>
        {/* DotField Background */}
        <div className="absolute inset-0 z-0 opacity-70">
          <DotField
            dotRadius={2}
            dotSpacing={16}
            bulgeStrength={70}
            glowRadius={160}
            sparkle={true}
            waveAmplitude={0}
            gradientFrom={isDark ? 'rgba(202, 164, 247, 0.40)' : 'rgba(136, 57, 239, 0.30)'}
            gradientTo={isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(168, 85, 247, 0.20)'}
            glowColor={isDark ? '#1E1E2A' : '#F0F2F6'}
          />
        </div>
        {/* Header */}
        <div className={`flex flex-col px-4 py-3 border-b ${borderColor} shrink-0 relative z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles size={8} className="text-white" />
              </div>
              <h2 className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>AI Assistant</h2>
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
                  className={`p-1.5 rounded-md ${textMuted} hover:text-red-500 hover:bg-red-500/10 transition-colors`}
                  title="Clear chat"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
          {/* Model Indicator */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className={`flex items-center gap-1 text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="font-mono">gemini-1.5-flash</span>
            </div>
          </div>
        </div>

        {/* Key rotation stats - compact */}
        {!localStorage.getItem(GEMINI_API_KEY_STORAGE) && geminiKeyRotation.hasKeys() && (
          <div className={`px-3 py-2 border-b ${borderColor} shrink-0 relative z-10`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1 flex-1">
                {keyStats.map(stat => (
                  <div
                    key={stat.keyIndex}
                    className={`flex-1 px-1 py-0.5 rounded text-center text-[9px] ${
                      stat.isCurrent
                        ? 'bg-purple-500/20 text-purple-400 font-bold'
                        : isDark
                          ? 'bg-slate-700/40 text-slate-500'
                          : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    K{stat.keyIndex} {stat.usage}/50
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  geminiKeyRotation.resetUsage();
                  setKeyStats(geminiKeyRotation.getUsageStats());
                }}
                className={`p-1 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-300'} ${textMuted} transition-colors`}
                title="Reset usage"
              >
                <RotateCcw size={11} />
              </button>
            </div>
          </div>
        )}

        {/* Quick actions - only show when no messages */}
        {messages.length === 0 && (
          <div className={`px-3 py-2 border-b ${borderColor} shrink-0 relative z-10`}>
            <div className="flex flex-wrap gap-1">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  disabled={isLoading || !activeFile}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all active:scale-95 disabled:opacity-40 ${
                    isDark
                      ? 'bg-[#232340] hover:bg-[#2a2a40] text-slate-300 border border-slate-700/50'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
            {!activeFile && (
              <p className={`text-[9px] mt-1.5 ${textMuted} opacity-60`}>Open a file to use quick actions.</p>
            )}
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden relative z-10">
          <div className="h-full overflow-y-auto scrollbar-hide p-3 space-y-3">
            {messages.length === 0 && (
              <div className={`flex flex-col items-center justify-center h-full py-8 ${textMuted}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-2">
                  <Sparkles size={18} className="text-purple-400" />
                </div>
                <p className="text-xs font-semibold">Ask AI anything</p>
                <p className="text-[10px] mt-1 opacity-50">Analyze, fix, or improve your code</p>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className={`p-3 border-t ${borderColor} shrink-0 relative z-10`}>
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeFile ? `Ask about ${activeFile.name}...` : 'Ask AI...'}
              className={`w-full pl-3 pr-10 py-2 rounded-lg text-[12px] focus:outline-none transition-colors border ${inputBg} ${textPrimary} placeholder:text-slate-400/60 focus:ring-1 focus:ring-[#CAA4F7]/50 focus:border-[#CAA4F7]/50`}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                !input.trim() || isLoading
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-[#CAA4F7] hover:bg-[#CAA4F7]/10'
              }`}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </form>
        </div>
      </div>
    </BorderGlow>
  );
};
