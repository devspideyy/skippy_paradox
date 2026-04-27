/**
 * CodeRunner — Execute code using Judge0 and display results.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Loader2, Terminal, X, AlertCircle, CheckCircle, Clock, Cpu } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { executeCode, mapMonacoLanguageToJudge0, ExecutionResult } from '../services/judge0Service';

interface CodeRunnerProps {
  code: string;
  language: string;
  fileName: string;
}

export const CodeRunner: React.FC<CodeRunnerProps> = ({ code, language, fileName }) => {
  const { isDark } = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stdin, setStdin] = useState('');
  const [showInput, setShowInput] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleRun = async () => {
    if (!code.trim()) {
      setError('No code to execute');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const judge0Lang = mapMonacoLanguageToJudge0(language);
      const executionResult = await executeCode({
        source_code: code,
        language: judge0Lang,
        stdin: stdin || undefined,
      });

      setResult(executionResult);
    } catch (e: any) {
      // Check if it's a network error (backend not running)
      if (e.message.includes('fetch') || e.message.includes('Failed to fetch')) {
        setError('Backend server not running. Please start the backend server at http://localhost:8000');
      } else {
        setError(e.message || 'Execution failed');
      }
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (result && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [result]);

  const bg = isDark ? 'bg-[#1a1a2e]' : 'bg-white';
  const border = isDark ? 'border-slate-700/50' : 'border-slate-200';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark ? 'bg-[#232340] border-slate-600/50' : 'bg-slate-50 border-slate-300';
  const outputBg = isDark ? 'bg-[#0d0d1a]' : 'bg-slate-900';

  const getStatusColor = (statusId: number) => {
    if (statusId === 3) return 'text-emerald-400'; // Accepted
    if (statusId === 4) return 'text-red-400'; // Wrong Answer
    if (statusId === 5) return 'text-yellow-400'; // Time Limit Exceeded
    if (statusId === 6) return 'text-orange-400'; // Compilation Error
    return 'text-slate-400';
  };

  const getStatusIcon = (statusId: number) => {
    if (statusId === 3) return <CheckCircle size={14} />;
    if (statusId === 6) return <AlertCircle size={14} />;
    return <Terminal size={14} />;
  };

  return (
    <div className={`flex flex-col h-full ${bg} border-t ${border}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${border} shrink-0`}>
        <div className="flex items-center gap-2">
          <Terminal size={14} className={textMuted} />
          <span className={`text-xs font-semibold ${textMuted}`}>Code Runner</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700/60' : 'bg-slate-200'} ${textMuted}`}>
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowInput(!showInput)}
            className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
              showInput
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                : `${textMuted} hover:bg-slate-700/30`
            }`}
          >
            Input
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-md text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play size={12} />
                Run Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Input Section */}
      {showInput && (
        <div className={`px-3 py-2 border-b ${border} shrink-0`}>
          <label className={`block text-[10px] font-semibold mb-1 ${textMuted}`}>
            STDIN (Input)
          </label>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Enter input for your program..."
            rows={3}
            className={`w-full px-2.5 py-2 rounded-lg text-[11px] font-mono border ${inputBg} ${
              isDark ? 'text-white' : 'text-slate-900'
            } placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none custom-scrollbar`}
          />
        </div>
      )}

      {/* Output Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {error && (
          <div className="mx-3 mt-3 flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3">
            {/* Status Bar */}
            <div className="flex items-center justify-between mb-3">
              <div className={`flex items-center gap-2 ${getStatusColor(result.status.id)}`}>
                {getStatusIcon(result.status.id)}
                <span className="text-xs font-semibold">{result.status.description}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                {result.time && (
                  <div className={`flex items-center gap-1 ${textMuted}`}>
                    <Clock size={11} />
                    <span>{result.time}s</span>
                  </div>
                )}
                {result.memory && (
                  <div className={`flex items-center gap-1 ${textMuted}`}>
                    <Cpu size={11} />
                    <span>{(result.memory / 1024).toFixed(1)} MB</span>
                  </div>
                )}
              </div>
            </div>

            {/* Compilation Error */}
            {result.compile_output && (
              <div className="mb-3">
                <div className={`text-[10px] font-semibold mb-1 ${textMuted}`}>COMPILATION ERROR</div>
                <div className={`${outputBg} rounded-lg p-3 overflow-x-auto custom-scrollbar`}>
                  <pre className="text-[11px] text-red-400 leading-relaxed whitespace-pre-wrap">
                    {result.compile_output}
                  </pre>
                </div>
              </div>
            )}

            {/* Standard Output */}
            {result.stdout && (
              <div className="mb-3">
                <div className={`text-[10px] font-semibold mb-1 ${textMuted}`}>OUTPUT</div>
                <div ref={outputRef} className={`${outputBg} rounded-lg p-3 overflow-x-auto custom-scrollbar max-h-[200px]`}>
                  <pre className="text-[11px] text-emerald-400 leading-relaxed whitespace-pre-wrap">
                    {result.stdout}
                  </pre>
                </div>
              </div>
            )}

            {/* Standard Error */}
            {result.stderr && (
              <div className="mb-3">
                <div className={`text-[10px] font-semibold mb-1 ${textMuted}`}>ERROR</div>
                <div className={`${outputBg} rounded-lg p-3 overflow-x-auto custom-scrollbar max-h-[200px]`}>
                  <pre className="text-[11px] text-red-400 leading-relaxed whitespace-pre-wrap">
                    {result.stderr}
                  </pre>
                </div>
              </div>
            )}

            {/* Message */}
            {result.message && (
              <div className="mb-3">
                <div className={`text-[10px] font-semibold mb-1 ${textMuted}`}>MESSAGE</div>
                <div className={`${outputBg} rounded-lg p-3`}>
                  <pre className="text-[11px] text-yellow-400 leading-relaxed whitespace-pre-wrap">
                    {result.message}
                  </pre>
                </div>
              </div>
            )}

            {/* No output */}
            {!result.stdout && !result.stderr && !result.compile_output && !result.message && (
              <div className={`text-center py-8 ${textMuted} text-xs`}>
                <Terminal size={24} className="mx-auto mb-2 opacity-40" />
                <p>No output</p>
              </div>
            )}
          </div>
        )}

        {!result && !error && !isRunning && (
          <div className={`flex-1 flex flex-col items-center justify-center ${textMuted} text-center px-4`}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 flex items-center justify-center mb-3">
              <Play size={22} className="text-emerald-400" />
            </div>
            <p className="text-xs font-semibold mb-1">Ready to run</p>
            <p className="text-[10px] opacity-60 max-w-[200px]">
              Click "Run Code" to execute your {language} code
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
