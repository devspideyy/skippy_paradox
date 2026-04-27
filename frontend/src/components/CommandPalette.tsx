/**
 * CommandPalette — VS Code-style command palette for power users.
 * Quick access to all actions with fuzzy search.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { 
  Search, FileCode, Plus, Upload, Github, Users, Sun, Moon, 
  Sparkles, MessageSquare, X, Command 
} from 'lucide-react';
import DotField from './DotField';

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fuzzy search
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery));
      return labelMatch || keywordMatch;
    });
  }, [query, commands]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  const bg = isDark ? 'bg-[#1a1a2e]' : 'bg-white';
  const border = isDark ? 'border-slate-700/50' : 'border-slate-200';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textM = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark ? 'bg-[#232340]' : 'bg-slate-50';

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" 
        onClick={onClose}
      />

      {/* Palette */}
      <div 
        className={`relative w-full max-w-2xl ${bg} rounded-2xl shadow-2xl border ${border} overflow-hidden animate-fade-in-up`}
        onClick={e => e.stopPropagation()}
      >
        {/* DotField Background */}
        <div className="absolute inset-0 z-0 opacity-35 pointer-events-none">
          <DotField
            dotRadius={1.5}
            dotSpacing={16}
            bulgeStrength={70}
            glowRadius={160}
            sparkle={true}
            waveAmplitude={0}
            gradientFrom={isDark ? 'rgba(202, 164, 247, 0.30)' : 'rgba(136, 57, 239, 0.25)'}
            gradientTo={isDark ? 'rgba(139, 92, 246, 0.18)' : 'rgba(168, 85, 247, 0.18)'}
            glowColor={isDark ? '#1a1a2e' : '#ffffff'}
          />
        </div>
        {/* Search Input */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${border} relative z-10`}>
          <Search size={20} className={textM} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className={`flex-1 bg-transparent text-base ${textP} placeholder:${textM} focus:outline-none`}
          />
          <kbd className={`px-2 py-1 rounded text-xs font-mono ${inputBg} ${textM} border ${border}`}>
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar relative z-10">
          {filteredCommands.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-12 ${textM}`}>
              <Search size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No commands found</p>
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  index === selectedIndex
                    ? isDark ? 'bg-purple-500/15 border-l-2 border-purple-500' : 'bg-purple-50 border-l-2 border-purple-500'
                    : isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                  index === selectedIndex
                    ? 'bg-purple-500/20 text-purple-400'
                    : isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  {cmd.icon}
                </div>
                <span className={`flex-1 text-left text-sm font-medium ${textP}`}>
                  {cmd.label}
                </span>
                {cmd.shortcut && (
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${inputBg} ${textM} border ${border}`}>
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-4 py-2 border-t ${border} ${textM} text-xs relative z-10`}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className={`px-1.5 py-0.5 rounded font-mono ${inputBg} border ${border}`}>↑</kbd>
              <kbd className={`px-1.5 py-0.5 rounded font-mono ${inputBg} border ${border}`}>↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className={`px-1.5 py-0.5 rounded font-mono ${inputBg} border ${border}`}>↵</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command size={12} />
            <span>+</span>
            <kbd className={`px-1.5 py-0.5 rounded font-mono ${inputBg} border ${border}`}>K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
};
