import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ChatMessage } from '../services/collabService';

interface ChatPanelProps {
  isOpen: boolean;
  messages: ChatMessage[];
  selfPeerId: string;
  onSendMessage: (text: string) => void;
  canSend?: boolean;
  onClose?: () => void;
}

const MAX_MESSAGE_LENGTH = 1200;

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  messages,
  selfPeerId,
  onSendMessage,
  canSend = true,
  onClose,
}) => {
  const { isDark } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const block = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', block, { passive: false });
    return () => el.removeEventListener('wheel', block);
  }, []);

  useEffect(() => {
    if (isOpen && canSend) inputRef.current?.focus();
  }, [isOpen, canSend]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const value = inputValue.trim();
    if (!value) return;
    onSendMessage(value);
    setInputValue('');
  };

  const remaining = MAX_MESSAGE_LENGTH - inputValue.length;

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bg = isDark ? 'bg-[#1E1E2A]' : 'bg-[#F0F2F6]';
  const border = isDark ? 'border-slate-700/40' : 'border-slate-300/40';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark
    ? 'bg-[#232340] border-slate-600/40'
    : 'bg-white border-slate-300';

  return (
    <div className={`flex flex-col h-full w-full ${bg} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${border} shrink-0`}>
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-[#CAA4F7]" />
          <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
            Room Chat
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1 rounded-md ${textMuted} hover:text-red-400 hover:bg-red-500/10 transition-colors`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto scrollbar-hide p-3 space-y-2.5"
        >
          {messages.length === 0 && (
            <div className={`flex flex-col items-center justify-center h-full ${textMuted}`}>
              <MessageSquare size={22} className="mb-2 opacity-30" />
              <p className="text-[11px]">No messages yet</p>
              <p className="text-[10px] mt-0.5 opacity-40">Say hello to your collaborators!</p>
            </div>
          )}

          {messages.map((msg) => {
            const isSelf = msg.peerId === selfPeerId;
            return (
              <div key={msg.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-0.5 mx-1">
                  {!isSelf && (
                    <div
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                      style={{ backgroundColor: msg.color }}
                    >
                      {msg.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={`text-[10px] font-medium ${isSelf ? 'text-[#CAA4F7]' : textMuted}`}>
                    {isSelf ? 'You' : msg.displayName}
                  </span>
                  <span className={`text-[9px] ${textMuted} opacity-40`}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`px-2.5 py-1.5 rounded-lg text-[12px] max-w-[85%] leading-relaxed ${
                    isSelf
                      ? 'bg-[#CAA4F7] text-[#1E1E2A] rounded-tr-sm'
                      : isDark
                        ? 'bg-[#232340] text-slate-200 rounded-tl-sm'
                        : 'bg-white text-slate-800 border border-slate-200/60 rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className={`p-2.5 border-t ${border} shrink-0`}>
        <form onSubmit={handleSend} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder={canSend ? 'Type a message...' : 'Join a room to chat'}
            disabled={!canSend}
            maxLength={MAX_MESSAGE_LENGTH}
            className={`w-full pl-3 pr-9 py-2 rounded-lg text-[12px] focus:outline-none transition-colors border ${inputBg} ${textPrimary} placeholder:text-slate-400/50 focus:ring-1 focus:ring-[#CAA4F7]/40 focus:border-[#CAA4F7]/40`}
          />
          <button
            type="submit"
            disabled={!canSend || !inputValue.trim()}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
              !canSend || !inputValue.trim()
                ? 'opacity-20 cursor-not-allowed'
                : 'text-[#CAA4F7] hover:bg-[#CAA4F7]/10'
            }`}
          >
            <Send size={13} />
          </button>
        </form>
        <div className={`mt-1 flex items-center justify-between text-[9px] ${textMuted} opacity-60`}>
          <span>{canSend ? 'Enter to send' : ''}</span>
          {remaining < 100 && <span className={remaining < 40 ? 'text-amber-400' : ''}>{remaining}</span>}
        </div>
      </div>
    </div>
  );
};
