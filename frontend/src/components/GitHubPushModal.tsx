import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import {
  X, Github, Upload, Loader2, CheckCircle2, AlertCircle,
  ExternalLink, Key, GitBranch, MessageSquare, Files, FileCode, Users, Trash2
} from 'lucide-react';
import { StoredFile } from '../services/storageService';
import {
  pushFilesToGitHub, PushResult, getStoredUser, GitHubUser
} from '../services/githubService';
import { soundEffects } from '../utils/soundEffects';
import BorderGlow from './BorderGlow';

// Separate storage key for push PAT — never shares with OAuth read token
const PUSH_PAT_KEY = 'skiffy-push-pat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  files: StoredFile[];
  activeFile: StoredFile | null;
  isInRoom: boolean;
  sharedFiles?: Array<{ id: string; name: string; language: string }>;
}

type Scope = 'all' | 'collab' | 'active';

export const GitHubPushModal: React.FC<Props> = ({
  isOpen,
  onClose,
  files,
  activeFile,
  isInRoom,
  sharedFiles = [],
}) => {
  const { isDark } = useTheme();

  // Destination state
  const defaultRepo = useMemo(() => {
    // If active file or any file has repo origin, use that
    const repoFile = files.find(f => f.repoOrigin);
    if (repoFile?.repoOrigin) {
      return `${repoFile.repoOrigin.owner}/${repoFile.repoOrigin.repo}`;
    }
    return 'devspideyy/skippy_paradox';
  }, [files]);

  const [repoString, setRepoString] = useState(defaultRepo);
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('feat: collaborative updates from Skiffy');
  const [scope, setScope] = useState<Scope>(isInRoom && sharedFiles.length > 0 ? 'collab' : 'all');

  // Auth state — uses a dedicated PAT key, never the OAuth read token
  const [token, setToken] = useState(() => localStorage.getItem(PUSH_PAT_KEY) || '');
  const [saveTokenLocally, setSaveTokenLocally] = useState(true);
  const [storedUser, setStoredUser] = useState<GitHubUser | null>(getStoredUser);
  const [tokenOk, setTokenOk] = useState<boolean | null>(null); // null = not validated

  // Execution state
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRepoString(defaultRepo);
      setError(null);
      setPushResult(null);
      setPushStatus('');
      setTokenOk(null);
      // Load only the dedicated push PAT, not the OAuth read token
      const savedPat = localStorage.getItem(PUSH_PAT_KEY) || '';
      setToken(savedPat);
      setStoredUser(getStoredUser());
    }
  }, [isOpen, defaultRepo]);

  // Determine files to push based on selected scope
  const filesToPush = useMemo(() => {
    if (scope === 'active' && activeFile) {
      return [{ path: activeFile.path || activeFile.name, content: activeFile.content }];
    }
    if (scope === 'collab' && isInRoom) {
      const sharedIds = new Set(sharedFiles.map(s => s.id));
      const filtered = files.filter(f => sharedIds.has(f.id));
      return (filtered.length > 0 ? filtered : files).map(f => ({
        path: f.path || f.name,
        content: f.content,
      }));
    }
    // Scope: 'all'
    return files.map(f => ({
      path: f.path || f.name,
      content: f.content,
    }));
  }, [scope, activeFile, isInRoom, sharedFiles, files]);

  if (!isOpen) return null;

  const handlePush = async () => {
    setError(null);
    setPushResult(null);

    const trimmedRepo = repoString.trim();
    if (!trimmedRepo.includes('/')) {
      setError("Please specify the repository as 'owner/repo' (e.g. devspideyy/skippy_paradox)");
      return;
    }

    const [owner, repo] = trimmedRepo.split('/');
    if (!owner || !repo) {
      setError("Invalid repository format. Must be 'owner/repo'.");
      return;
    }

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError('Please provide a GitHub Personal Access Token (PAT) with repo scope.');
      return;
    }

    if (filesToPush.length === 0) {
      setError('No files available to push.');
      return;
    }

    if (saveTokenLocally) {
      // Save under dedicated push-PAT key only
      localStorage.setItem(PUSH_PAT_KEY, trimmedToken);
    }

    setIsPushing(true);
    setPushStatus('Preparing Git tree and commit...');

    try {
      setPushStatus(`Pushing ${filesToPush.length} file(s) to ${owner}/${repo} (${branch})...`);
      const res = await pushFilesToGitHub({
        owner,
        repo,
        branch: branch.trim() || 'main',
        message: commitMessage.trim() || 'feat: updates from Skiffy',
        files: filesToPush,
        token: trimmedToken,
      });

      setPushResult(res);
      soundEffects.success();
    } catch (err: any) {
      setError(err.message || 'Failed to push to GitHub');
      soundEffects.error?.();
    } finally {
      setIsPushing(false);
      setPushStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <BorderGlow
        glowColor={isDark ? '270 80 70' : '270 60 50'}
        backgroundColor={isDark ? '#1e1e2e' : '#ffffff'}
        borderRadius={20}
        glowRadius={30}
        glowIntensity={0.8}
        className="w-full max-w-xl transition-all duration-300"
      >
        <div
          className={`relative w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-[#1e1e2e] text-slate-200' : 'bg-white text-slate-800'
          }`}
          onClick={e => e.stopPropagation()}
        >

        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
              <Github size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Push to GitHub
                {isInRoom && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Users size={10} /> Collab Session
                  </span>
                )}
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Commit and push your collaborative code directly to your GitHub repository
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Success Banner */}
          {pushResult && (
            <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <span>Successfully pushed {pushResult.filesPushed} file(s)!</span>
              </div>
              <p className="text-xs opacity-90">
                Commit SHA: <code className="font-mono bg-black/20 px-1 py-0.5 rounded">{pushResult.commitSha.slice(0, 7)}</code>
              </p>
              <a
                href={pushResult.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold underline hover:opacity-80 mt-1"
              >
                View commit on GitHub <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              isDark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Destination Repo & Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Github size={13} /> Repository (owner/repo)
              </label>
              <input
                type="text"
                value={repoString}
                onChange={e => setRepoString(e.target.value)}
                placeholder="devspideyy/skippy_paradox"
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-700/80 focus:border-purple-500 text-slate-100'
                    : 'bg-slate-50 border-slate-300 focus:border-purple-500 text-slate-900'
                }`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <GitBranch size={13} /> Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                placeholder="main"
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-700/80 focus:border-purple-500 text-slate-100'
                    : 'bg-slate-50 border-slate-300 focus:border-purple-500 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Commit Message */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <MessageSquare size={13} /> Commit Message
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={e => setCommitMessage(e.target.value)}
              placeholder="feat: collaborative updates from Skiffy"
              className={`w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors ${
                isDark
                  ? 'bg-slate-900/60 border-slate-700/80 focus:border-purple-500 text-slate-100'
                  : 'bg-slate-50 border-slate-300 focus:border-purple-500 text-slate-900'
              }`}
            />
          </div>

          {/* Scope Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <Files size={13} /> Files to Include ({filesToPush.length})
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  scope === 'all'
                    ? (isDark ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-purple-50 border-purple-400 text-purple-700')
                    : (isDark ? 'border-slate-800 hover:bg-slate-800/40 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-600')
                }`}
              >
                <span>All Workspace</span>
                <span className="text-[10px] opacity-75">{files.length} files</span>
              </button>

              {isInRoom && (
                <button
                  type="button"
                  onClick={() => setScope('collab')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    scope === 'collab'
                      ? (isDark ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-emerald-50 border-emerald-400 text-emerald-700')
                      : (isDark ? 'border-slate-800 hover:bg-slate-800/40 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-600')
                  }`}
                >
                  <span>Collab Shared</span>
                  <span className="text-[10px] opacity-75">{sharedFiles.length} files</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setScope('active')}
                disabled={!activeFile}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-40 ${
                  scope === 'active'
                    ? (isDark ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-blue-50 border-blue-400 text-blue-700')
                    : (isDark ? 'border-slate-800 hover:bg-slate-800/40 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-600')
                }`}
              >
                <span>Active File</span>
                <span className="text-[10px] opacity-75 truncate max-w-[120px]">{activeFile ? activeFile.name : 'None'}</span>
              </button>
            </div>

            {/* File List Chips */}
            <div className={`flex flex-wrap gap-1.5 p-2 rounded-lg border max-h-24 overflow-y-auto custom-scrollbar ${
              isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'
            }`}>
              {filesToPush.map((f, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
                    isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <FileCode size={11} className="text-purple-400 shrink-0" />
                  <span className="truncate max-w-[140px]">{f.path}</span>
                </span>
              ))}
            </div>
          </div>

          {/* GitHub Auth Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Key size={13} /> GitHub Personal Access Token
              </label>
              {storedUser && (
                <span className="text-[11px] text-purple-400 font-medium">
                  Logged in as @{storedUser.login}
                </span>
              )}
            </div>

            {/* Token hint banner */}
            <div className={`text-[11px] px-3 py-2 rounded-lg flex items-start gap-2 ${
              isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>
                Requires a <strong>Personal Access Token</strong> (PAT) with <code className="font-mono">repo</code> scope.
                {' '}This is <em>different</em> from your GitHub login — it won't pick up the Import OAuth token automatically.
              </span>
            </div>

            <div className="relative">
              <input
                type="password"
                value={token}
                onChange={e => { setToken(e.target.value); setTokenOk(null); setError(null); }}
                placeholder="ghp_... or github_pat_..."
                className={`w-full px-3 py-2 pr-8 text-xs font-mono rounded-lg border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-700/80 focus:border-purple-500 text-slate-100'
                    : 'bg-slate-50 border-slate-300 focus:border-purple-500 text-slate-900'
                } ${tokenOk === false ? (isDark ? 'border-red-500' : 'border-red-400') : ''}`}
              />
              {token && (
                <button
                  type="button"
                  onClick={() => { setToken(''); setTokenOk(null); localStorage.removeItem(PUSH_PAT_KEY); }}
                  title="Clear saved token"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-[11px] cursor-pointer opacity-80 hover:opacity-100">
                <input
                  type="checkbox"
                  checked={saveTokenLocally}
                  onChange={e => setSaveTokenLocally(e.target.checked)}
                  className="rounded border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                Remember token on this device
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
              >
                Generate Token <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50'}`}>
          <div className="text-xs text-slate-400 truncate max-w-[240px]">
            {pushStatus || (isPushing ? 'Working...' : `Ready to push ${filesToPush.length} files`)}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={isPushing}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              Close
            </button>
            <button
              onClick={handlePush}
              disabled={isPushing || filesToPush.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isPushing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Commit & Push
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </BorderGlow>
  </div>
);
};
