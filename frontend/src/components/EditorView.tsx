import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ModernMonacoEditor } from './ModernMonacoEditor';
import { CollabMonacoEditor } from './CollabMonacoEditor';
import { FileExplorer } from './FileExplorer';
import { CollabBar } from './CollabBar';
import { ChatPanel } from './ChatPanel';
import { GeminiPanel } from './GeminiPanel';
import VoiceLobbyPanel from './VoiceLobbyPanel';
import { CodeRunner } from './CodeRunner';
import DotField from './DotField';
import { StoredFile } from '../services/storageService';
import { SharedFileInfo } from '../services/collabService';
import { VoiceManager } from '../services/voiceManager';
import { useTheme } from '../hooks/useTheme';
import { detectLanguage, detectLanguageAI } from '../utils/detectLanguage';
import {
  FileCode, Plus, Upload, Code2, FolderOpen, Sun, Moon,
  Github, Users, X, MessageSquare, PanelRightClose, Menu, Sparkles, Headphones, Play,
} from 'lucide-react';
import {
  JavaScript, TypeScript, Python, CPlusPlus, C, Java, Go, RustDark, Ruby, PHP,
} from 'developer-icons';

/* ── Language icon map ─────────────────────────────────────────────── */
const langIconMap: Record<string, { icon: any }> = {
  JavaScript: { icon: JavaScript }, TypeScript: { icon: TypeScript },
  Python: { icon: Python }, 'C++': { icon: CPlusPlus }, C: { icon: C },
  Java: { icon: Java }, Go: { icon: Go }, Rust: { icon: RustDark },
  Ruby: { icon: Ruby }, PHP: { icon: PHP },
};

function LanguageIcon({ language, size = 16, className = '' }: { language: string; size?: number; className?: string }) {
  const entry = langIconMap[language];
  if (!entry) return <FileCode size={size} className={className} />;
  const Icon = entry.icon;
  return <div className={className} style={{ display: 'inline-flex', alignItems: 'center' }}><Icon size={size} /></div>;
}

/* ── Resize handle ─────────────────────────────────────────────────── */
function ResizeHandle({ isDark }: { isDark: boolean }) {
  return (
    <Separator
      className={`group relative flex items-center justify-center w-[5px] cursor-col-resize select-none transition-colors
        ${isDark ? 'bg-slate-800/60 hover:bg-purple-500/40' : 'bg-slate-300/60 hover:bg-purple-400/40'}`}
    >
      <div className={`w-[3px] h-8 rounded-full transition-all duration-150
        ${isDark ? 'bg-slate-600 group-hover:bg-purple-400 group-active:bg-purple-300' : 'bg-slate-400 group-hover:bg-purple-500 group-active:bg-purple-600'}
        group-hover:h-12 group-active:h-16`}
      />
    </Separator>
  );
}

/* ── Types ─────────────────────────────────────────────────────────── */
interface CollabHook {
  status: import('../services/collabService').CollabStatus;
  roomId: string | null;
  isHost: boolean;
  displayName: string;
  color: string;
  members: import('../services/collabService').CollabMember[];
  pending: import('../services/collabService').PendingRequest[];
  sharedFiles: SharedFileInfo[];
  provider: import('../services/collabService').CollabProvider | null;
  toasts: import('../hooks/useCollabRoom').CollabToast[];
  chatMessages: import('../services/collabService').ChatMessage[];
  peerId: string;
  leaveRoom: () => void;
  approveJoin: (peerId: string) => void;
  rejectJoin: (peerId: string) => void;
  shareFile: (file: { id: string; name: string; language: string; content: string }) => void;
  unshareFile: (fileId: string) => void;
  dismissToast: (id: string) => void;
  sendChatMessage: (text: string) => void;
  voiceManager: VoiceManager;
}

interface EditorViewProps {
  files: StoredFile[];
  activeFileId: string | null;
  loadingFileId: string | null;
  onFileSelect: (id: string) => void;
  onFileCreate: () => void;
  onFileDelete: (id: string) => void;
  onFileUpload: (file: File) => void;
  onCodeChange: (id: string, newCode: string) => void;
  onLanguageChange: (id: string, language: string) => void;
  onOpenGitHub: () => void;
  onOpenCollab: () => void;
  onRepoDelete?: (repoKey: string) => void;
  collab: CollabHook;
}

type MobilePane = 'editor' | 'runner' | 'gemini' | 'chat' | 'voice';

/* ── Component ─────────────────────────────────────────────────────── */
export const EditorView: React.FC<EditorViewProps> = ({
  files, activeFileId, loadingFileId, onFileSelect, onFileCreate, onFileDelete, onFileUpload,
  onCodeChange, onLanguageChange, onOpenGitHub, onOpenCollab, onRepoDelete, collab,
}) => {
  const { isDark, toggleTheme } = useTheme();

  const activeFile = useMemo((): StoredFile | null => {
    if (!activeFileId) return null;
    const local = files.find(f => f.id === activeFileId);
    if (local) return local;
    const shared = collab.sharedFiles.find(f => f.id === activeFileId);
    if (shared) return { id: shared.id, name: shared.name, language: shared.language, content: '', contentHash: '', lastModified: Date.now() } as StoredFile;
    return null;
  }, [activeFileId, files, collab.sharedFiles]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGeminiOpen, setIsGeminiOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ ln: 1, col: 1 });
  const [selectionCount, setSelectionCount] = useState(0);
  const [fontSize] = useState(() => parseInt(localStorage.getItem('editor-font-size') || '16', 10));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastChatCountRef = useRef(0);
  const isInRoom = collab.status === 'connected' || collab.status === 'waiting-approval' || collab.status === 'connecting';

  useEffect(() => { setCursorPosition({ ln: 1, col: 1 }); setSelectionCount(0); }, [activeFileId]);

  useEffect(() => {
    if (!activeFile || activeFile.language) return;
    const syncLang = detectLanguage(activeFile.name, activeFile.content);
    if (syncLang) onLanguageChange(activeFile.id, syncLang);
    if (activeFile.content?.trim().length > 20) {
      detectLanguageAI(activeFile.name, activeFile.content).then(aiLang => {
        if (aiLang && aiLang !== syncLang) onLanguageChange(activeFile.id, aiLang);
      });
    }
  }, [activeFile?.id, activeFile?.language, activeFile?.name, activeFile?.content, onLanguageChange]);

  useEffect(() => { localStorage.setItem('editor-font-size', fontSize.toString()); }, [fontSize]);

  useEffect(() => {
    const currentCount = collab.chatMessages.length;

    if (isChatOpen) {
      setUnreadChatCount(0);
      lastChatCountRef.current = currentCount;
      return;
    }

    if (collab.status === 'connected' && currentCount > lastChatCountRef.current) {
      setUnreadChatCount((prev) => prev + (currentCount - lastChatCountRef.current));
    }

    lastChatCountRef.current = currentCount;
  }, [collab.chatMessages.length, collab.status, isChatOpen]);

  useEffect(() => {
    if (!collab.roomId) {
      setUnreadChatCount(0);
      lastChatCountRef.current = 0;
      setIsChatOpen(false);
      setIsVoiceOpen(false);
      setMobilePane('editor');
    }
  }, [collab.roomId]);

  useEffect(() => {
    if (!isInRoom && (mobilePane === 'chat' || mobilePane === 'voice')) {
      setMobilePane('editor');
    }
  }, [isInRoom, mobilePane]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sharedFileIds = useMemo(() => new Set(collab.sharedFiles.map(f => f.id)), [collab.sharedFiles]);
  const isActiveFileShared = activeFileId ? sharedFileIds.has(activeFileId) : false;

  const collabFileContents = useMemo(() => {
    const m = new Map<string, StoredFile>();
    for (const sf of collab.sharedFiles) {
      const local = files.find(f => f.id === sf.id);
      if (local) m.set(sf.id, local);
    }
    return m;
  }, [collab.sharedFiles, files]);

  const handleAddToCollab = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    collab.shareFile({ id: file.id, name: file.name, language: file.language, content: file.content });
  }, [files, collab]);

  const handleRemoveFromCollab = useCallback((fileId: string) => { collab.unshareFile(fileId); }, [collab]);
  const handleSelectCollabFile = useCallback((fileId: string) => { onFileSelect(fileId); }, [onFileSelect]);
  const handleMobileFileSelect = useCallback((fileId: string) => {
    onFileSelect(fileId);
    setIsSidebarOpen(false);
    setMobilePane('editor');
  }, [onFileSelect]);

  const bg = isDark ? 'bg-[#1E1E2A]' : 'bg-[#E5E8EE]';
  const bgEditor = isDark ? 'bg-[#232332]' : 'bg-[#EEF1F5]';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const borderColor = isDark ? 'border-slate-800/50' : 'border-slate-300/50';

  return (
    <div className={`flex flex-col h-[100dvh] ${bg} text-slate-300 overflow-hidden overflow-x-hidden`}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={`h-14 flex items-center justify-between px-4 ${isDark ? 'bg-[#181821]' : 'bg-[#DBDFE7]'} z-20 shadow-sm border-b ${borderColor}`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open file sidebar"
            className={`md:hidden p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}>
            <Menu size={20} />
          </button>
          <img src="/CodeCollab-logo.png" alt="CodeCollab Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
          <span className={`hidden sm:inline font-black tracking-tighter quantico-font text-[24px] sm:text-[28px] ${textPrimary} select-none`}>
            CodeCollab
          </span>
          <button 
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`relative flex items-center justify-center w-8 h-8 ml-1 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 rounded-lg ${isDark ? 'text-slate-400 hover:text-amber-300' : 'text-slate-500 hover:text-blue-500'}`}>
            <Sun size={20} className={`absolute transition-all duration-500 ease-in-out ${isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'}`} />
            <Moon size={20} className={`absolute transition-all duration-500 ease-in-out ${isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden md:flex items-center gap-1.5">
            {/* Gemini toggle */}
            <button
              onClick={() => setIsGeminiOpen(prev => !prev)}
              aria-label={isGeminiOpen ? 'Close AI Assistant panel' : 'Open AI Assistant panel'}
              aria-expanded={isGeminiOpen}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                isGeminiOpen
                  ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/15 text-blue-600'
                  : isDark ? 'text-slate-400 hover:bg-slate-700/50 hover:text-blue-400' : 'text-slate-500 hover:bg-slate-200 hover:text-blue-600'
              }`}
              title={isGeminiOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
            >
              <Sparkles size={17} />
            </button>

            {/* Voice + Chat toggle (collab only) */}
            {isInRoom && (
              <>
                <button
                  onClick={() => setIsVoiceOpen(prev => !prev)}
                  aria-label={isVoiceOpen ? 'Close voice panel' : 'Open voice panel'}
                  aria-expanded={isVoiceOpen}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    isVoiceOpen
                      ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/15 text-emerald-600'
                      : isDark ? 'text-slate-400 hover:bg-slate-700/50 hover:text-emerald-400' : 'text-slate-500 hover:bg-slate-200 hover:text-emerald-600'
                  }`}
                  title={isVoiceOpen ? 'Close Voice' : 'Open Voice'}
                >
                  <Headphones size={17} />
                </button>
                <button
                  onClick={() => setIsChatOpen(prev => !prev)}
                  aria-label={isChatOpen ? 'Close chat panel' : 'Open chat panel'}
                  aria-expanded={isChatOpen}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    isChatOpen
                      ? isDark ? 'bg-[#CAA4F7]/20 text-[#CAA4F7]' : 'bg-[#CAA4F7]/15 text-[#9B6DD7]'
                      : isDark ? 'text-slate-400 hover:bg-slate-700/50 hover:text-[#CAA4F7]' : 'text-slate-500 hover:bg-slate-200 hover:text-[#9B6DD7]'
                  }`}
                  title={isChatOpen ? 'Close Chat' : 'Open Chat'}
                >
                  {!isChatOpen && unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-pink-500 text-white text-[9px] leading-4 font-bold">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                  {isChatOpen ? <PanelRightClose size={18} /> : <MessageSquare size={18} />}
                </button>
              </>
            )}
          </div>

          {!isInRoom && (
            <button onClick={onOpenCollab}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CAA4F7]/15 hover:bg-[#CAA4F7]/25 text-[#CAA4F7] text-xs font-bold transition-all active:scale-95 border border-[#CAA4F7]/20">
              <Users size={14} /> Collab
            </button>
          )}
        </div>
      </header>

      {/* ── Main content (resizable panels) ─────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* Mobile sidebar drawer */}
        <div className={`fixed md:hidden inset-y-0 left-0 z-50 w-[86vw] max-w-[320px] flex flex-col ${bg} border-r ${borderColor} transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
            <span className={`font-bold ${textPrimary}`}>Files</span>
            <button onClick={() => setIsSidebarOpen(false)} className={`p-1.5 rounded-md ${textMuted} hover:bg-red-500/10 hover:text-red-500 transition-colors`}>
              <X size={20} />
            </button>
          </div>
          <div className="px-2 pt-3 pb-2 space-y-2">
            <div className="flex gap-2">
              <button onClick={onFileCreate} className="flex-1 flex items-center justify-center gap-2 bg-[#CAA4F7] hover:bg-[#D4B5F9] text-[#1E1E2A] py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                <Plus size={14} /> New Snippet
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                aria-label="Upload file"
                className="flex items-center justify-center px-3 rounded-lg bg-[#CAA4F7]/20 hover:bg-[#CAA4F7]/30 text-[#CAA4F7] border border-[#CAA4F7]/30 transition-all active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" 
                title="Upload File">
                <Upload size={14} />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            </div>
            <button 
              onClick={onOpenGitHub}
              aria-label="Import repository from GitHub"
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all border focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${isDark ? 'bg-[#232340] hover:bg-[#2a2a50] text-slate-300 border-slate-700/50 hover:border-purple-500/50' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-300 hover:border-purple-400'} active:scale-[0.98] shadow-sm`}>
              <Github size={14} /> Import from GitHub
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
            <FileExplorer files={files} activeFileId={activeFileId} loadingFileId={loadingFileId}
              onFileSelect={handleMobileFileSelect} onFileDelete={onFileDelete} onRepoDelete={onRepoDelete}
              isInRoom={isInRoom} isHost={collab.isHost} sharedFiles={collab.sharedFiles}
              collabFileContents={collabFileContents} onAddToCollab={handleAddToCollab}
              onRemoveFromCollab={handleRemoveFromCollab} onSelectCollabFile={handleSelectCollabFile} />
          </div>
        </div>

        {/* Desktop: resizable panel group */}
        <Group orientation="horizontal" className="flex-1 min-h-0 hidden md:flex" id="editor-layout">

          {/* Sidebar panel */}
          <Panel defaultSize="18%" minSize="12%" maxSize="35%" className={`flex flex-col ${bg} border-r ${borderColor}`}>
            <div className="px-2 pt-4 pb-2 space-y-2 shrink-0">
              <div className="flex gap-2">
                <button onClick={onFileCreate} className="flex-1 flex items-center justify-center gap-2 bg-[#CAA4F7] hover:bg-[#D4B5F9] text-[#1E1E2A] py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                  <Plus size={14} /> New Snippet
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center px-3 rounded-lg bg-[#CAA4F7]/20 hover:bg-[#CAA4F7]/30 text-[#CAA4F7] border border-[#CAA4F7]/30 transition-all active:scale-95 shadow-sm" title="Upload File">
                  <Upload size={14} />
                </button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              </div>
              <button onClick={onOpenGitHub}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all border ${isDark ? 'bg-[#232340] hover:bg-[#2a2a50] text-slate-300 border-slate-700/50 hover:border-purple-500/50' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-300 hover:border-purple-400'} active:scale-[0.98] shadow-sm`}>
                <Github size={14} /> Import from GitHub
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
              {files.length === 0 && !(isInRoom && collab.sharedFiles.length > 0) ? (
                <div className={`flex flex-col items-center justify-center h-full py-8 ${textMuted}`}>
                  <FolderOpen size={28} className="mb-3 opacity-50" />
                  <p className="text-xs text-center">No snippets yet</p>
                </div>
              ) : (
                <FileExplorer files={files} activeFileId={activeFileId} loadingFileId={loadingFileId}
                  onFileSelect={onFileSelect} onFileDelete={onFileDelete} onRepoDelete={onRepoDelete}
                  isInRoom={isInRoom} isHost={collab.isHost} sharedFiles={collab.sharedFiles}
                  collabFileContents={collabFileContents} onAddToCollab={handleAddToCollab}
                  onRemoveFromCollab={handleRemoveFromCollab} onSelectCollabFile={handleSelectCollabFile} />
              )}
            </div>
          </Panel>

          <ResizeHandle isDark={isDark} />

          {/* Editor panel */}
          <Panel defaultSize={isGeminiOpen && isChatOpen ? "44%" : isGeminiOpen || isChatOpen ? "56%" : "82%"} minSize="30%" className="flex flex-col min-w-0">
            {!activeFile ? (
              <div className={`flex-1 flex flex-col items-center justify-center ${bgEditor} h-full relative overflow-hidden`}>
                {/* DotField Background */}
                <div className="absolute inset-0 z-0">
                  <DotField
                    dotRadius={2}
                    dotSpacing={14}
                    bulgeStrength={80}
                    glowRadius={200}
                    sparkle={true}
                    waveAmplitude={0}
                    gradientFrom={isDark ? 'rgba(202, 164, 247, 0.45)' : 'rgba(136, 57, 239, 0.35)'}
                    gradientTo={isDark ? 'rgba(139, 92, 246, 0.30)' : 'rgba(168, 85, 247, 0.25)'}
                    glowColor={isDark ? '#1E1E2A' : '#E5E8EE'}
                  />
                </div>
                {/* Content */}
                <div className="text-center max-w-md px-8 relative z-10">
                  <FolderOpen size={48} className={`mx-auto mb-8 ${isDark ? 'text-blue-400/50' : 'text-blue-500/50'}`} />
                  <h2 className={`text-xl font-semibold mb-2 ${textPrimary}`}>Welcome to CodeCollab</h2>
                  <div className="flex gap-4 justify-center">
                    <button onClick={onFileCreate} className="flex items-center gap-2 px-6 py-3 bg-[#CAA4F7] hover:bg-[#D4B5F9] text-[#1E1E2A] rounded-lg text-sm font-medium transition-colors shadow-md">
                      <Plus size={18} /> New Snippet
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Group orientation="horizontal" className="flex-1 relative overflow-hidden h-full">
                {/* Editor Panel */}
                <Panel defaultSize="70%" minSize="35%" className="relative overflow-hidden">
                  {collab.status === 'waiting-approval' && (
                    <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center ${isDark ? 'bg-[#1e1e2e]/90' : 'bg-[#eff1f5]/90'} backdrop-blur-sm`}>
                      <Users size={32} className="text-[#CAA4F7] mb-4" />
                      <p className={`text-sm font-medium ${textPrimary}`}>Waiting for host approval...</p>
                      <p className={`text-xs mt-1 ${textMuted}`}>The room host will accept or reject your request.</p>
                      <button onClick={collab.leaveRoom} className="mt-4 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold hover:bg-red-500/25 transition-colors">Cancel</button>
                    </div>
                  )}
                  {isActiveFileShared && collab.provider && collab.status === 'connected' ? (
                    <CollabMonacoEditor file={activeFile} theme={isDark ? 'dark' : 'light'} fontSize={fontSize}
                      provider={collab.provider} onChange={(code) => onCodeChange(activeFile.id, code)}
                      onCursorChange={(ln, col) => setCursorPosition({ ln, col })}
                      onSelectionChange={(count) => setSelectionCount(count)} />
                  ) : (
                    <ModernMonacoEditor file={activeFile} theme={isDark ? 'dark' : 'light'} fontSize={fontSize}
                      onChange={(code) => onCodeChange(activeFile.id, code)}
                      onCursorChange={(ln, col) => setCursorPosition({ ln, col })}
                      onSelectionChange={(count) => setSelectionCount(count)} />
                  )}
                </Panel>

                {/* Vertical Resize Handle */}
                <Separator
                  className={`group relative flex items-center justify-center w-[5px] cursor-col-resize select-none transition-all duration-150 ease-out
                    ${isDark ? 'bg-slate-800/60 hover:bg-emerald-500/40' : 'bg-slate-300/60 hover:bg-emerald-400/40'}`}
                >
                  <div className={`w-[3px] h-8 rounded-full transition-all duration-200 ease-out
                    ${isDark ? 'bg-slate-600 group-hover:bg-emerald-400 group-active:bg-emerald-300' : 'bg-slate-400 group-hover:bg-emerald-500 group-active:bg-emerald-600'}
                    group-hover:h-12 group-active:h-16`}
                  />
                </Separator>

                {/* Code Runner Panel */}
                <Panel defaultSize="30%" minSize="15%" maxSize="60%" className="overflow-hidden">
                  <CodeRunner
                    code={activeFile.content}
                    language={activeFile.language}
                    fileName={activeFile.name}
                  />
                </Panel>
              </Group>
            )}
          </Panel>

          {/* Gemini panel */}
          {isGeminiOpen && (
            <>
              <ResizeHandle isDark={isDark} />
              <Panel defaultSize="26%" minSize="18%" maxSize="45%" className="flex flex-col min-w-0">
                <GeminiPanel activeFile={activeFile} />
              </Panel>
            </>
          )}

          {/* Chat panel (collab only) */}
          {isInRoom && isChatOpen && (
            <>
              <ResizeHandle isDark={isDark} />
              <Panel defaultSize="22%" minSize="16%" maxSize="40%" className="flex flex-col min-w-0">
                <ChatPanel isOpen={true} messages={collab.chatMessages} selfPeerId={collab.peerId}
                  onSendMessage={collab.sendChatMessage} canSend={collab.status === 'connected'} onClose={() => setIsChatOpen(false)} />
              </Panel>
            </>
          )}

          {/* Voice panel (collab only) */}
          {isInRoom && isVoiceOpen && (
            <>
              <ResizeHandle isDark={isDark} />
              <Panel defaultSize="20%" minSize="14%" maxSize="35%" className="flex flex-col min-w-0">
                <VoiceLobbyPanel
                  isOpen={true}
                  members={collab.members}
                  selfPeerId={collab.peerId}
                  provider={collab.provider}
                  canUseVoice={collab.status === 'connected'}
                  onClose={() => setIsVoiceOpen(false)}
                  voiceManager={collab.voiceManager}
                />
              </Panel>
            </>
          )}

        </Group>

        {/* Mobile: non-resizable layout */}
        <div className="flex-1 flex flex-col min-w-0 md:hidden">
          <div className={`shrink-0 border-b ${borderColor} px-2 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hide`}>
            {([
              { id: 'editor', label: 'Editor', icon: <Code2 size={13} /> },
              { id: 'runner', label: 'Run', icon: <Play size={13} /> },
              { id: 'gemini', label: 'AI', icon: <Sparkles size={13} /> },
            ] as Array<{ id: MobilePane; label: string; icon: React.ReactNode }>).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMobilePane(tab.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                  mobilePane === tab.id
                    ? (isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-500/15 text-purple-700')
                    : (isDark ? 'text-slate-400 bg-slate-800/40' : 'text-slate-600 bg-slate-200/70')
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}

            {isInRoom && (
              <>
                <button
                  onClick={() => setMobilePane('chat')}
                  className={`relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                    mobilePane === 'chat'
                      ? (isDark ? 'bg-[#CAA4F7]/20 text-[#CAA4F7]' : 'bg-[#CAA4F7]/15 text-[#9B6DD7]')
                      : (isDark ? 'text-slate-400 bg-slate-800/40' : 'text-slate-600 bg-slate-200/70')
                  }`}
                >
                  <MessageSquare size={13} /> Chat
                  {mobilePane !== 'chat' && unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-pink-500 text-white text-[8px] leading-3.5 font-bold">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setMobilePane('voice')}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                    mobilePane === 'voice'
                      ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/15 text-emerald-700')
                      : (isDark ? 'text-slate-400 bg-slate-800/40' : 'text-slate-600 bg-slate-200/70')
                  }`}
                >
                  <Headphones size={13} /> Voice
                </button>
              </>
            )}
          </div>

          {mobilePane === 'editor' && !activeFile ? (
            <div className={`flex-1 flex flex-col items-center justify-center ${bgEditor} relative overflow-hidden`}>
              {/* DotField Background */}
              <div className="absolute inset-0 z-0">
                <DotField
                  dotRadius={2}
                  dotSpacing={14}
                  bulgeStrength={80}
                  glowRadius={200}
                  sparkle={true}
                  waveAmplitude={0}
                  gradientFrom={isDark ? 'rgba(202, 164, 247, 0.45)' : 'rgba(136, 57, 239, 0.35)'}
                  gradientTo={isDark ? 'rgba(139, 92, 246, 0.30)' : 'rgba(168, 85, 247, 0.25)'}
                  glowColor={isDark ? '#1E1E2A' : '#E5E8EE'}
                />
              </div>
              {/* Content */}
              <div className="text-center max-w-md px-8 relative z-10">
                <FolderOpen size={48} className={`mx-auto mb-8 ${isDark ? 'text-blue-400/50' : 'text-blue-500/50'}`} />
                <h2 className={`text-xl font-semibold mb-2 ${textPrimary}`}>Welcome to CodeCollab</h2>
                <button onClick={onFileCreate} className="flex items-center gap-2 px-6 py-3 bg-[#CAA4F7] hover:bg-[#D4B5F9] text-[#1E1E2A] rounded-lg text-sm font-medium transition-colors shadow-md">
                  <Plus size={18} /> New Snippet
                </button>
              </div>
            </div>
          ) : mobilePane === 'editor' ? (
            <div className="flex-1 relative overflow-hidden">
              {collab.status === 'waiting-approval' && (
                <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center ${isDark ? 'bg-[#1e1e2e]/90' : 'bg-[#eff1f5]/90'} backdrop-blur-sm`}>
                  <Users size={28} className="text-[#CAA4F7] mb-3" />
                  <p className={`text-sm font-medium ${textPrimary}`}>Waiting for host approval...</p>
                  <p className={`text-xs mt-1 ${textMuted}`}>The room host will accept or reject your request.</p>
                  <button onClick={collab.leaveRoom} className="mt-4 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold hover:bg-red-500/25 transition-colors">Cancel</button>
                </div>
              )}
              {isActiveFileShared && collab.provider && collab.status === 'connected' ? (
                <CollabMonacoEditor file={activeFile} theme={isDark ? 'dark' : 'light'} fontSize={fontSize}
                  provider={collab.provider} onChange={(code) => onCodeChange(activeFile.id, code)}
                  onCursorChange={(ln, col) => setCursorPosition({ ln, col })}
                  onSelectionChange={(count) => setSelectionCount(count)} />
              ) : (
                <ModernMonacoEditor file={activeFile} theme={isDark ? 'dark' : 'light'} fontSize={fontSize}
                  onChange={(code) => onCodeChange(activeFile.id, code)}
                  onCursorChange={(ln, col) => setCursorPosition({ ln, col })}
                  onSelectionChange={(count) => setSelectionCount(count)} />
              )}
            </div>
          ) : mobilePane === 'runner' ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeFile ? (
                <CodeRunner code={activeFile.content} language={activeFile.language} fileName={activeFile.name} />
              ) : (
                <div className={`h-full flex flex-col items-center justify-center ${bgEditor} ${textMuted}`}>
                  <Play size={24} className="mb-2 opacity-50" />
                  <p className="text-xs font-semibold">Open a file to run code</p>
                </div>
              )}
            </div>
          ) : mobilePane === 'gemini' ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <GeminiPanel activeFile={activeFile} />
            </div>
          ) : mobilePane === 'chat' ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              {isInRoom ? (
                <ChatPanel
                  isOpen={true}
                  messages={collab.chatMessages}
                  selfPeerId={collab.peerId}
                  onSendMessage={collab.sendChatMessage}
                  canSend={collab.status === 'connected'}
                  onClose={() => setMobilePane('editor')}
                />
              ) : (
                <div className={`h-full flex flex-col items-center justify-center ${bgEditor} ${textMuted}`}>
                  <MessageSquare size={24} className="mb-2 opacity-50" />
                  <p className="text-xs font-semibold">Join a room to use chat</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              {isInRoom ? (
                <VoiceLobbyPanel
                  isOpen={true}
                  members={collab.members}
                  selfPeerId={collab.peerId}
                  provider={collab.provider}
                  canUseVoice={collab.status === 'connected'}
                  onClose={() => setMobilePane('editor')}
                  voiceManager={collab.voiceManager}
                />
              ) : (
                <div className={`h-full flex flex-col items-center justify-center ${bgEditor} ${textMuted}`}>
                  <Headphones size={24} className="mb-2 opacity-50" />
                  <p className="text-xs font-semibold">Join a room to use voice</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <div className={`hidden md:flex h-8 items-center justify-between px-2 sm:px-4 text-[10px] sm:text-[12px] kode-font font-black ${isDark ? 'bg-[#181821] text-white/70' : 'bg-[#DBDFE7] text-slate-700'}`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 h-4">
            <FileCode size={14} className="hidden sm:block" />
            <span>{files.length} FILES</span>
          </div>
          {activeFile && (
            <div className="flex items-center animate-fade-in">
              <div className={`flex items-center gap-2 h-6 transition-colors ${isDark ? 'text-white/70' : 'text-slate-700'}`}>
                <LanguageIcon language={activeFile.language} size={14} />
                <span>{activeFile.language ? activeFile.language.toUpperCase() : 'AUTO DETECTING...'}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeFile && (
            <div className="flex items-center gap-1.5 h-4">
              <Code2 size={14} className="hidden sm:block" />
              <span>LN {cursorPosition.ln}, COL {cursorPosition.col} <span className="hidden sm:inline">{selectionCount > 0 && `(${selectionCount} selected)`}</span></span>
            </div>
          )}
        </div>
      </div>

      {/* ── Collab bar ──────────────────────────────────────────────── */}
      {isInRoom && collab.roomId && (
        <CollabBar roomId={collab.roomId} status={collab.status} isHost={collab.isHost}
          members={collab.members} pending={collab.pending} toasts={collab.toasts}
          onApprove={collab.approveJoin} onReject={collab.rejectJoin} onLeave={collab.leaveRoom}
          onDismissToast={collab.dismissToast} />
      )}

      {/* ── Toasts ──────────────────────────────────────────────────── */}
      {collab.toasts.length > 0 && (
        <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2.5 pointer-events-none">
          {collab.toasts.map(toast => (
            <div key={toast.id}
              className={`pointer-events-auto relative flex items-center gap-3 pl-4 pr-3 py-3 min-w-[240px] max-w-[360px] rounded-2xl shadow-2xl text-[12px] font-semibold overflow-hidden
                ${toast.exiting ? 'animate-toast-out' : 'animate-toast-in'}
                ${toast.type === 'error'   ? 'bg-[#3a1a1e]/90 text-[#ff8fa3] border border-[#ff4d6d]/25' :
                  toast.type === 'success' ? 'bg-[#1a2e1e]/90 text-[#8fd9a8] border border-[#4ade80]/25' :
                  toast.type === 'warning' ? 'bg-[#2e2510]/90 text-[#fcd34d] border border-[#fbbf24]/25' :
                  isDark ? 'bg-[#1e1e2e]/90 text-[#cdd6f4] border border-[#45475a]/60'
                         : 'bg-white/90 text-[#1e1e2e] border border-slate-200/80'
                } backdrop-blur-xl`}
            >
              {/* Icon only — no text badge */}
              <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-[15px] ${
                toast.destination === 'collab'  ? 'bg-purple-500/20' :
                toast.destination === 'myfiles' ? 'bg-blue-500/20'   :
                toast.type === 'error'          ? 'bg-red-500/20'     :
                toast.type === 'success'        ? 'bg-green-500/20'   :
                toast.type === 'warning'        ? 'bg-amber-500/20'   : 'bg-slate-500/20'
              }`}>
                {toast.destination === 'collab'  ? '⚡' :
                 toast.destination === 'myfiles' ? '📁' :
                 toast.type === 'error'          ? '✕'  :
                 toast.type === 'success'        ? '✓'  :
                 toast.type === 'warning'        ? '!'  : 'ℹ'}
              </div>

              {/* Text block */}
              <div className="flex-1 min-w-0">
                {toast.fileName && (
                  <div className={`truncate font-bold text-[11px] mb-0.5 ${
                    toast.destination === 'collab'  ? 'text-purple-300' :
                    toast.destination === 'myfiles' ? 'text-blue-300'   : 'opacity-90'
                  }`}>{toast.fileName}</div>
                )}
                <span className="leading-snug opacity-80">{toast.message}</span>
              </div>

              <button 
                onClick={() => collab.dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/10 transition-all active:scale-90 opacity-40 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/30">
                <X size={12} />
              </button>

              {!toast.exiting && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-2xl overflow-hidden">
                  <div className={`h-full rounded-b-2xl origin-left ${
                    toast.type === 'error'   ? 'bg-[#ff4d6d]/50' :
                    toast.type === 'success' ? 'bg-[#4ade80]/50' :
                    toast.type === 'warning' ? 'bg-[#fbbf24]/50' : 'bg-[#CAA4F7]/50'
                  }`} style={{ animation: 'toastDrain 4s linear forwards' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
