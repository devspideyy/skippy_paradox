/**
 * ChatPanel — Side panel for room text chat.
 * Themed to match the app's dark/light mode.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ChatMessage } from '../services/collabService';
import BorderGlow from './BorderGlow';
import DotField from './DotField';

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && canSend) {
      inputRef.current?.focus();
    }
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

  const remainingChars = MAX_MESSAGE_LENGTH - inputValue.length;

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Theme tokens — match the app's palette
  const panelBg = isDark ? 'bg-[#1E1E2A]' : 'bg-[#F0F2F6]';
  const borderColor = isDark ? 'border-slate-700/50' : 'border-slate-300/50';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark ? 'bg-[#232340] border-slate-600/50' : 'bg-white border-slate-300';
  const selfBubble = 'bg-[#CAA4F7] text-[#1E1E2A]';
  const otherBubble = isDark
    ? 'bg-[#232340] text-slate-200'
    : 'bg-white text-slate-800 border border-slate-200/80';

  return (
    <BorderGlow
      backgroundColor={isDark ? '#1E1E2A' : '#F0F2F6'}
      colors={['#CAA4F7', '#9B6DD7', '#38bdf8']}
      borderRadius={0}
      glowRadius={30}
      glowIntensity={0.8}
      glowColor="280 60 85"
      fillOpacity={0.2}
      className="h-full w-full no-panel-scroll"
    >
      <div className={`flex flex-col min-h-0 h-full w-full ${panelBg} relative overflow-hidden`}>
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
        <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor} shrink-0 relative z-10`}>
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-[#CAA4F7]" />
            <h2 className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Room Chat</h2>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className={`p-1.5 rounded-md ${textMuted} hover:text-red-500 hover:bg-red-500/10 transition-colors`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 min-h-0 overflow-hidden relative z-10">
          <div className="h-full overflow-y-auto scrollbar-hide p-3 space-y-3">
            {messages.length === 0 && (
              <div className={`flex flex-col items-center justify-center h-full py-8 ${textMuted}`}>
                <MessageSquare size={24} className="mb-2 opacity-40" />
                <p className="text-xs">No messages yet</p>
                <p className="text-[10px] mt-1 opacity-50">Say hello to your collaborators!</p>
              </div>
            )}
            {messages.map((msg) => {
              const isSelf = msg.peerId === selfPeerId;
              return (
                <div key={msg.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 mx-1">
                    {!isSelf && (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                        style={{ backgroundColor: msg.color }}
                      >
                        {msg.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={`text-[10px] font-semibold ${isSelf ? 'text-[#CAA4F7]' : textMuted}`}>
                      {isSelf ? 'You' : msg.displayName}
                    </span>
                    <span className={`text-[9px] ${textMuted} opacity-50`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  <div
                    className={`px-3 py-2 rounded-lg text-[12px] max-w-[85%] leading-relaxed ${
                      isSelf
                        ? `${selfBubble} rounded-tr-sm`
                        : `${otherBubble} rounded-tl-sm`
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

        {/* Input Area */}
        <div className={`p-3 border-t ${borderColor} shrink-0 relative z-10`}>
          <form onSubmit={handleSend} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              placeholder={canSend ? 'Type a message...' : 'Chat is available after you join the room'}
              disabled={!canSend}
              maxLength={MAX_MESSAGE_LENGTH}
              className={`w-full pl-3 pr-10 py-2 rounded-lg text-[12px] focus:outline-none transition-colors border ${inputBg} ${textPrimary} placeholder:text-slate-400/60 focus:ring-1 focus:ring-[#CAA4F7]/50 focus:border-[#CAA4F7]/50`}
            />
            <button
              type="submit"
              disabled={!canSend || !inputValue.trim()}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                !canSend || !inputValue.trim()
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-[#CAA4F7] hover:bg-[#CAA4F7]/10'
              }`}
            >
              <Send size={14} />
            </button>
          </form>
          <div className={`mt-1.5 flex items-center justify-between text-[10px] ${textMuted}`}>
            <span>{canSend ? 'Press Enter to send' : 'Waiting for room connection'}</span>
            <span className={remainingChars < 80 ? 'text-amber-400' : ''}>{remainingChars}</span>
          </div>
        </div>
      </div>
    </BorderGlow>
  );
};
