/**
 * CodeRunner — Authentic, sleek terminal UI for running code via OnlineCompiler / Backend API.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Loader2,
  Terminal as TerminalIcon,
  Check,
  Copy,
  Trash2,
  CornerDownLeft,
  X,
  Clock,
  Cpu,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { executeCode, mapMonacoLanguageToJudge0, ExecutionResult } from '../services/judge0Service';
import { inferLanguageFromSnippet } from '../utils/detectLanguage';

export const SUPPORTED_RUNNER_LANGS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'C++',
  'C',
  'Java',
  'Go',
  'Rust',
  'Ruby',
  'PHP',
  'C#',
  'Bash',
  'SQL',
];

interface CodeRunnerProps {
  code: string;
  language: string;
  fileName: string;
  onClose?: () => void;
  onLanguageChange?: (language: string) => void;
}

interface TerminalSession {
  id: string;
  timestamp: string;
  command: string;
  result?: ExecutionResult;
  error?: string;
}

const getCommandForLanguage = (language: string, fileName: string): string => {
  const lang = (language || '').toLowerCase();
  const name = fileName || 'script';
  if (lang.includes('python')) return `python3 ${name}`;
  if (lang.includes('javascript') || lang === 'js' || lang === 'node') return `node ${name}`;
  if (lang.includes('typescript') || lang === 'ts') return `deno run ${name}`;
  if (lang.includes('cpp') || lang.includes('c++')) return `g++ -O2 ${name} && ./a.out`;
  if (lang === 'c') return `gcc -O2 ${name} && ./a.out`;
  if (lang.includes('java')) return `javac ${name} && java Main`;
  if (lang.includes('go')) return `go run ${name}`;
  if (lang.includes('rust')) return `rustc ${name} && ./main`;
  if (lang.includes('ruby')) return `ruby ${name}`;
  if (lang.includes('php')) return `php ${name}`;
  if (lang.includes('csharp') || lang.includes('c#')) return `dotnet run ${name}`;
  return `run ${name}`;
};

export const CodeRunner: React.FC<CodeRunnerProps> = ({
  code,
  language,
  fileName,
  onClose,
  onLanguageChange,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<TerminalSession[]>([]);
  const [currentRunningCmd, setCurrentRunningCmd] = useState<string | null>(null);
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  const detected = inferLanguageFromSnippet(code);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    language || detected || 'Python'
  );

  useEffect(() => {
    if (language) {
      setSelectedLanguage(language);
    } else if (detected) {
      setSelectedLanguage(detected);
    }
  }, [language, detected]);

  // Auto-scroll to bottom when new terminal output arrives
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isRunning]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;

    const activeLang = selectedLanguage || language || detected || 'Python';
    const trimmedCode = code.trim();
    const command = getCommandForLanguage(activeLang, fileName);
    const timeStr = new Date().toLocaleTimeString([], { hour12: false });
    const sessionId = Date.now().toString();

    if (!trimmedCode) {
      setHistory((prev) => [
        ...prev,
        {
          id: sessionId,
          timestamp: timeStr,
          command,
          error: 'Error: Cannot execute empty source file. Write some code first.',
        },
      ]);
      return;
    }

    setIsRunning(true);
    setCurrentRunningCmd(command);

    try {
      const judge0Lang = mapMonacoLanguageToJudge0(activeLang);
      const executionResult = await executeCode({
        source_code: code,
        language: judge0Lang,
        stdin: stdin || undefined,
      });

      setHistory((prev) => [
        ...prev,
        {
          id: sessionId,
          timestamp: timeStr,
          command,
          result: executionResult,
        },
      ]);
    } catch (e: any) {
      const msg = e?.message || 'Execution failed';
      let friendlyError = msg;
      if (msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        friendlyError =
          'Network Error: Could not connect to API server. Ensure the backend server is running and accessible.';
      }

      setHistory((prev) => [
        ...prev,
        {
          id: sessionId,
          timestamp: timeStr,
          command,
          error: friendlyError,
        },
      ]);
    } finally {
      setIsRunning(false);
      setCurrentRunningCmd(null);
    }
  }, [code, language, fileName, stdin, isRunning, selectedLanguage, detected]);

  // Global shortcut: Ctrl+Enter or Cmd+Enter to run code
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun]);

  const handleClear = () => {
    setHistory([]);
  };

  const handleCopy = async () => {
    if (history.length === 0) return;
    const textToCopy = history
      .map((item) => {
        let text = `$ ${item.command}\n`;
        if (item.error) text += `[ERROR] ${item.error}\n`;
        if (item.result?.compile_output) text += `[COMPILATION ERROR]\n${item.result.compile_output}\n`;
        if (item.result?.stdout) text += item.result.stdout;
        if (item.result?.stderr) text += `[STDERR]\n${item.result.stderr}\n`;
        if (item.result?.status) text += `[Status: ${item.result.status.description}]\n`;
        return text;
      })
      .join('\n───────────────────────\n\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy terminal output:', err);
    }
  };

  const lastSession = history.length > 0 ? history[history.length - 1] : null;
  const lastResult = lastSession?.result;
  const isAccepted = lastResult?.status?.id === 3;

  return (
    <div className="flex flex-col h-full bg-[#0a0d14] text-slate-200 border-l border-slate-800/80 select-text overflow-hidden font-sans">
      {/* ── Terminal Window Titlebar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0e131f] border-b border-slate-800/80 shrink-0 select-none">
        {/* Left: Window Controls + Tab */}
        <div className="flex items-center gap-2.5">
          {/* Traffic light window dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <button
              onClick={onClose || handleClear}
              title={onClose ? 'Close Terminal' : 'Clear Terminal'}
              aria-label="Close or clear terminal"
              className="w-2.5 h-2.5 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors cursor-pointer"
            />
            <button
              onClick={() => setShowStdin(!showStdin)}
              title="Toggle STDIN Input"
              aria-label="Toggle STDIN input"
              className="w-2.5 h-2.5 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors cursor-pointer"
            />
            <button
              onClick={handleRun}
              title="Run Code"
              aria-label="Run Code"
              className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/40 text-[11px] font-mono text-slate-300">
            <TerminalIcon size={12} className="text-emerald-400" />
            <span className="font-semibold">terminal</span>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/40 text-slate-400 hidden sm:inline-block truncate max-w-[130px]">
            {fileName || 'script'}
          </span>

          {/* Language Selector Dropdown */}
          <div className="relative flex items-center">
            <select
              value={selectedLanguage}
              onChange={(e) => {
                const nextLang = e.target.value;
                setSelectedLanguage(nextLang);
                onLanguageChange?.(nextLang);
              }}
              aria-label="Execution Language"
              className="bg-slate-800/90 hover:bg-slate-700/80 text-emerald-400 font-mono text-[10px] pl-2 pr-4 py-0.5 rounded border border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none transition-colors"
              title="Execution language"
            >
              {SUPPORTED_RUNNER_LANGS.map((lang) => (
                <option key={lang} value={lang} className="bg-[#0e131f] text-slate-200">
                  {lang}
                </option>
              ))}
            </select>
            <span className="absolute right-1 pointer-events-none text-slate-400 text-[8px]">▾</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* STDIN Toggle button */}
          <button
            onClick={() => setShowStdin(!showStdin)}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded font-mono transition-all ${
              showStdin
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Toggle program standard input (stdin)"
          >
            <CornerDownLeft size={11} />
            <span className="hidden sm:inline">STDIN</span>
            {stdin.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            )}
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            disabled={history.length === 0}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Copy terminal output"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>

          {/* Clear Button */}
          <button
            onClick={handleClear}
            disabled={history.length === 0 && !isRunning}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Clear terminal (clear)"
          >
            <Trash2 size={13} />
          </button>

          {/* Run Code Button */}
          <button
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-md text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            title="Execute Code (Ctrl + Enter)"
          >
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play size={12} className="fill-current" />
                <span>Run</span>
                <span className="hidden lg:inline text-[9px] opacity-75 font-mono">^↵</span>
              </>
            )}
          </button>

          {/* Optional close button if parent provides onClose */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors ml-1"
              title="Close Panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── STDIN Input Drawer ── */}
      {showStdin && (
        <div className="px-3 py-2 bg-[#0c101a] border-b border-slate-800/80 shrink-0 animate-fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono font-semibold text-purple-400 flex items-center gap-1">
              <CornerDownLeft size={11} /> STDIN / PROGRAM INPUT
            </span>
            {stdin && (
              <button
                onClick={() => setStdin('')}
                className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                Clear input
              </button>
            )}
          </div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Type standard input here (e.g. for input(), scanf(), cin, readline)..."
            rows={3}
            className="w-full px-2.5 py-1.5 rounded bg-[#131826] border border-slate-700/60 text-xs font-mono text-purple-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 resize-none custom-scrollbar leading-relaxed"
          />
        </div>
      )}

      {/* ── Terminal Canvas Screen ── */}
      <div
        ref={terminalContainerRef}
        className="flex-1 p-3 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed space-y-3 bg-[#080b11]"
      >
        {/* Startup Welcome Header */}
        <div className="text-slate-400 text-[11px] leading-relaxed border border-slate-800/60 bg-[#0d121e]/60 rounded-md p-2.5 font-mono select-none">
          <div className="text-emerald-400 font-bold flex items-center gap-2">
            <span>● Skiffy Cloud Terminal v2.0</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              OnlineCompiler Cloud
            </span>
          </div>
          <div className="text-slate-400 text-[10px] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Target: <strong className="text-slate-300">{fileName || 'main'}</strong></span>
            <span>Language: <strong className="text-slate-300">{language || 'Plain Text'}</strong></span>
            <span>Shortcut: <strong className="text-purple-300">Ctrl + Enter</strong></span>
          </div>
        </div>

        {/* History of executed runs */}
        {history.map((session, idx) => {
          const res = session.result;

          return (
            <div key={session.id} className="space-y-1.5 pt-1">
              {/* Command Prompt Line */}
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-emerald-400 font-semibold select-none">guest@skiffy</span>
                <span className="text-slate-500 select-none">:</span>
                <span className="text-blue-400 font-semibold select-none">~</span>
                <span className="text-slate-400 select-none">$</span>
                <span className="text-slate-100 font-bold">{session.command}</span>
                <span className="text-[9px] text-slate-400 ml-auto select-none">{session.timestamp}</span>
              </div>

              {/* Network / Client error */}
              {session.error && (
                <div className="pl-3 border-l-2 border-rose-500 text-rose-400 text-[11px] bg-rose-500/10 py-1.5 px-2 rounded-r">
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <AlertCircle size={13} />
                    <span>Execution Error</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono">{session.error}</pre>
                </div>
              )}

              {/* Compilation Error Output */}
              {res?.compile_output && (
                <div className="pl-3 border-l-2 border-amber-500 text-rose-300 text-[11px] bg-rose-950/20 py-1.5 px-2 rounded-r">
                  <div className="text-amber-400 font-bold text-[10px] mb-1 tracking-wider uppercase flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>Compilation Error</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-rose-400 font-mono">{res.compile_output}</pre>
                </div>
              )}

              {/* Standard Output (stdout) */}
              {res?.stdout && (
                <div className="pl-3 border-l-2 border-emerald-500/80 text-emerald-300 py-1 px-1">
                  <pre className="whitespace-pre-wrap font-mono text-emerald-200 select-text leading-relaxed">
                    {res.stdout}
                  </pre>
                </div>
              )}

              {/* Standard Error (stderr) */}
              {res?.stderr && (
                <div className="pl-3 border-l-2 border-rose-500/80 text-rose-400 py-1 px-1 bg-rose-950/10 rounded-r">
                  <div className="text-rose-400 font-semibold text-[10px] mb-0.5 uppercase tracking-wide">
                    STDERR
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-rose-400 select-text leading-relaxed">
                    {res.stderr}
                  </pre>
                </div>
              )}

              {/* Special message from compiler */}
              {res?.message && (
                <div className="pl-3 border-l-2 border-yellow-500/80 text-yellow-300 text-[11px] py-1 px-1">
                  <pre className="whitespace-pre-wrap font-mono">{res.message}</pre>
                </div>
              )}

              {/* Empty Output Note */}
              {res && !res.stdout && !res.stderr && !res.compile_output && !res.message && (
                <div className="text-slate-400 italic text-[11px] pl-3">
                  (Program finished with no console output)
                </div>
              )}

              {/* Process summary footer */}
              {res && (
                <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5 pl-3 select-none">
                  <div className="flex items-center gap-1">
                    {res.status.id === 3 ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={11} /> {res.status.description}
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1 font-semibold">
                        <AlertCircle size={11} /> {res.status.description}
                      </span>
                    )}
                  </div>
                  {res.time && (
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>{res.time}s</span>
                    </div>
                  )}
                  {res.memory && (
                    <div className="flex items-center gap-1">
                      <Cpu size={10} />
                      <span>{(res.memory / 1024).toFixed(1)} MB</span>
                    </div>
                  )}
                </div>
              )}

              {/* Divider between sessions */}
              {idx < history.length - 1 && (
                <div className="border-b border-slate-800/40 my-2" />
              )}
            </div>
          );
        })}

        {/* Active Running State */}
        {isRunning && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-emerald-400 font-semibold">guest@skiffy</span>
              <span className="text-slate-500">:</span>
              <span className="text-blue-400 font-semibold">~</span>
              <span className="text-slate-400">$</span>
              <span className="text-slate-100 font-bold">{currentRunningCmd}</span>
            </div>
            <div className="flex items-center gap-2 pl-3 text-emerald-400 text-xs py-1">
              <Loader2 size={13} className="animate-spin" />
              <span className="animate-pulse">Compiling & executing in cloud sandbox...</span>
            </div>
          </div>
        )}

        {/* Interactive Prompt & Blinking Cursor when idle */}
        {!isRunning && (
          <div className="flex items-center gap-1.5 text-slate-300 pt-1 select-none">
            <span className="text-emerald-400 font-semibold">guest@skiffy</span>
            <span className="text-slate-500">:</span>
            <span className="text-blue-400 font-semibold">~</span>
            <span className="text-slate-400">$</span>
            <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse align-middle" />
          </div>
        )}

        <div ref={terminalBottomRef} />
      </div>

      {/* ── Status Bar at Terminal Bottom ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e131f] border-t border-slate-800/80 text-[10px] font-mono text-slate-400 select-none">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRunning
                  ? 'bg-amber-400 animate-ping'
                  : isAccepted
                  ? 'bg-emerald-400'
                  : 'bg-slate-400'
              }`}
            />
            <span className="text-slate-300">
              {isRunning
                ? 'RUNNING'
                : lastResult
                ? lastResult.status.description.toUpperCase()
                : 'READY'}
            </span>
          </span>
          {lastResult?.time && (
            <span>• {lastResult.time}s</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>Ctrl + Enter to Run</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-400">OnlineCompiler</span>
        </div>
      </div>
    </div>
  );
};
