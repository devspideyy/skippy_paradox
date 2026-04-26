import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ModernMonacoEditor } from './ModernMonacoEditor';
import { CollabMonacoEditor } from './CollabMonacoEditor';
import { FileExplorer } from './FileExplorer';
import { CollabBar } from './CollabBar';
import { StoredFile } from '../services/storageService';
import { SharedFileInfo } from '../services/collabService';
import { useTheme } from '../hooks/useTheme';
import { detectLanguage, detectLanguageAI } from '../utils/detectLanguage';
import {
  FileCode, Plus, Upload, Code2, FolderOpen, Sun, Moon, Github, Users, X, MessageSquare, PanelRightClose, Menu, GripVertical
} from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import {
  JavaScript, TypeScript, Python, CPlusPlus, C, Java, Go, RustDark, Ruby, PHP
} from 'developer-icons';

const langIconMap: Record<string, { icon: any }> = {
  JavaScript: { icon: JavaScript },
  TypeScript: { icon: TypeScript },
  Python: { icon: Python },
  'C++': { icon: CPlusPlus },
  C: { icon: C },
  Java: { icon: Java },
  Go: { icon: Go },
  Rust: { icon: RustDark },
  Ruby: { icon: Ruby },
  PHP: { icon: PHP },
};

function LanguageIcon({ language, size = 16, className = '', colorOverride }: { language: string; size?: number; className?: string; colorOverride?: string }) {
  const entry = langIconMap[language];
  if (!entry) return <FileCode size={size} className={className} />;
  const Icon = entry.icon;
  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Icon size={size} color={colorOverride ? 'currentColor' : undefined} />
    </div>
  );
}

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

export const EditorView: React.FC<EditorViewProps> = ({
  files, activeFileId, loadingFileId, onFileSelect, onFileCreate, onFileDelete, onFileUpload,
  onCodeChange, onLanguageChange, onOpenGitHub, onOpenCollab, onRepoDelete, collab,
}) => {
  const { isDark, toggleTheme } = useTheme();

  // Look up active file from local files OR collab shared files (for clients)
  const activeFile = useMemo((): StoredFile | null => {
    if (!activeFileId) return null;
    const local = files.find(f => f.id === activeFileId);
    if (local) return local;
    // Client may not have the file locally — create synthetic entry from collab metadata
    const shared = collab.sharedFiles.find(f => f.id === activeFileId);
    if (shared) {
      return {
        id: shared.id,
        name: shared.name,
        language: shared.language,
        content: '', // Content comes from Y.Doc via CollabMonacoEditor
        contentHash: '',
        lastModified: Date.now(),
      } as StoredFile;
    }
    return null;
  }, [activeFileId, files, collab.sharedFiles]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ ln: 1, col: 1 });
  const [selectionCount, setSelectionCount] = useState(0);
  const [fontSize] = useState(() => {
    const saved = localStorage.getItem('editor-font-size');
    return saved ? parseInt(saved, 10) : 16;
  });
  // Persist panel sizes across sessions
  const [sidebarSize, setSidebarSize] = useState(() => {
    const s = localStorage.getItem('panel-sidebar-size');
    return s ? parseFloat(s) : 18;
  });
  const [chatSize, setChatSize] = useState(() => {
    const s = localStorage.getItem('panel-chat-size');
    return s ? parseFloat(s) : 22;
  });

  const handleSidebarResize = useCallback((size: number) => {
    setSidebarSize(size);
    localStorage.setItem('panel-sidebar-size', String(size));
  }, []);
  const handleChatResize = useCallback((size: number) => {
    setChatSize(size);
    localStorage.setItem('panel-chat-size', String(size));
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCursorPosition({ ln: 1, col: 1 });
    setSelectionCount(0);
  }, [activeFileId]);

  // Detect language
  useEffect(() => {
    if (!activeFile || activeFile.language) return;
    const syncLang = detectLanguage(activeFile.name, activeFile.content);
    if (syncLang) onLanguageChange(activeFile.id, syncLang);
    if (activeFile.content && activeFile.content.trim().length > 20) {
      detectLanguageAI(activeFile.name, activeFile.content).then(aiLang => {
        if (aiLang && aiLang !== syncLang) onLanguageChange(activeFile.id, aiLang);
      });
    }
  }, [activeFile?.id, activeFile?.language, activeFile?.name, activeFile?.content, onLanguageChange]);

  useEffect(() => {
    localStorage.setItem('editor-font-size', fontSize.toString());
  }, [fontSize]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Collab state ─────────────────────────────────────────────────────

  const isInRoom = collab.status === 'connected' || collab.status === 'waiting-approval' || collab.status === 'connecting';
  const sharedFileIds = useMemo(
    () => new Set(collab.sharedFiles.map(f => f.id)),
    [collab.sharedFiles],
  );

  // Is the active file a shared (collab) file?
  const isActiveFileShared = activeFileId ? sharedFileIds.has(activeFileId) : false;

  // Build collabFileContents map — shared file data for the explorer
  const collabFileContents = useMemo(() => {
    const m = new Map<string, StoredFile>();
    for (const sf of collab.sharedFiles) {
      const local = files.find(f => f.id === sf.id);
      if (local) m.set(sf.id, local);
    }
    return m;
  }, [collab.sharedFiles, files]);

  // ── Host: add file to collab ─────────────────────────────────────────

  const handleAddToCollab = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    collab.shareFile({
      id: file.id,
      name: file.name,
      language: file.language,
      content: file.content,
    });
  };

  // ── Host: remove file from collab ────────────────────────────────────

  const handleRemoveFromCollab = (fileId: string) => {
    collab.unshareFile(fileId);
  };

  // ── Select a collab file ─────────────────────────────────────────────

  const handleSelectCollabFile = (fileId: string) => {
    // If this client already has the file locally, just select it
    const localFile = files.find(f => f.id === fileId);
    if (localFile) {
      onFileSelect(fileId);
    } else {
      // For clients: we need to select it (file will be in sharedFiles list)
      onFileSelect(fileId);
    }
  };

  const bg = isDark ? 'bg-[#1E1E2A]' : 'bg-[#E5E8EE]';
  const bgEditor = isDark ? 'bg-[#232332]' : 'bg-[#EEF1F5]';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';

  return (
    <div className={`flex flex-col h-screen ${bg} text-slate-300 overflow-hidden`}>
      <header className={`h-14 flex items-center justify-between px-4 ${isDark ? 'bg-[#181821]' : 'bg-[#DBDFE7]'} z-20 shadow-sm border-b ${isDark ? 'border-slate-800/50' : 'border-slate-300/50'}`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`md:hidden p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
            aria-label="Open Sidebar"
          >
            <Menu size={20} />
          </button>
          <img src="/CodeCollab-logo.png" alt="CodeCollab Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
          <span className={`hidden sm:inline font-black tracking-tighter quantico-font text-[24px] sm:text-[28px] ${textPrimary} select-none`}>
            CodeCollab
          </span>
          <button 
            onClick={toggleTheme} 
            className={`relative flex items-center justify-center w-8 h-8 ml-1 transition-colors ${isDark ? 'text-slate-400 hover:text-amber-300' : 'text-slate-500 hover:text-blue-500'}`}
            aria-label="Toggle Theme"
          >
            <Sun 
              size={20} 
              className={`absolute transition-all duration-500 ease-in-out ${isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'}`} 
            />
            <Moon 
              size={20} 
              className={`absolute transition-all duration-500 ease-in-out ${isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} 
            />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isInRoom && (
            <button
              onClick={() => setIsChatOpen(prev => !prev)}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95 ${
                isChatOpen
                  ? isDark ? 'bg-[#CAA4F7]/20 text-[#CAA4F7]' : 'bg-[#CAA4F7]/15 text-[#9B6DD7]'
                  : isDark ? 'text-slate-400 hover:bg-slate-700/50 hover:text-[#CAA4F7]' : 'text-slate-500 hover:bg-slate-200 hover:text-[#9B6DD7]'
              }`}
              title={isChatOpen ? 'Close Chat' : 'Open Chat'}
            >
              {isChatOpen ? <PanelRightClose size={18} /> : <MessageSquare size={18} />}
            </button>
          )}
          {!isInRoom && (
            <button
              onClick={onOpenCollab}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CAA4F7]/15 hover:bg-[#CAA4F7]/25 text-[#CAA4F7] text-xs font-bold transition-all active:scale-95 border border-[#CAA4F7]/20"
            >
              <Users size={14} /> Collab
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm transition-opacity" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed md:relative inset-y-0 left-0 z-50 w-[280px] md:w-64 transform transition-transform duration-300 ease-in-out md:transform-none flex flex-col ${bg} border-r ${isDark ? 'border-slate-800/50' : 'border-slate-300/50'} md:border-r-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className={`flex md:hidden items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-300/50'}`}>
            <span className={`font-bold ${textPrimary}`}>Files</span>
            <button onClick={() => setIsSidebarOpen(false)} className={`p-1.5 rounded-md ${textMuted} hover:bg-red-500/10 hover:text-red-500 transition-colors`}>
              <X size={20} />
            </button>
          </div>
          <div className="px-2 pt-4 pb-2 space-y-2">
            <div className="flex gap-2">
              <button onClick={onFileCreate} className="flex-1 flex items-center justify-center gap-2 bg-[#CAA4F7] hover:bg-[#D4B5F9] text-[#1E1E2A] py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                <Plus size={14} /> New Snippet
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center px-3 rounded-lg bg-[#CAA4F7]/20 hover:bg-[#CAA4F7]/30 text-[#CAA4F7] border border-[#CAA4F7]/30 transition-all active:scale-95 shadow-sm" title="Upload File">
                <Upload size={14} />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".js,.ts,.jsx,.tsx,.py,.cpp,.c,.java,.go,.rs,.rb,.php" onChange={handleFileUpload} />
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
              <FileExplorer
                files={files}
                activeFileId={activeFileId}
                loadingFileId={loadingFileId}
                onFileSelect={onFileSelect}
                onFileDelete={onFileDelete}
                onRepoDelete={onRepoDelete}
                isInRoom={isInRoom}
                isHost={collab.isHost}
                sharedFiles={collab.sharedFiles}
                collabFileContents={collabFileContents}
                onAddToCollab={handleAddToCollab}
                onRemoveFromCollab={handleRemoveFromCollab}
                onSelectCollabFile={handleSelectCollabFile}
              />
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {!activeFile ? (
            <div className={`flex-1 flex flex-col items-center justify-center ${bgEditor}`}>
              <div className="text-center max-w-md px-8">
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
            <div className="flex-1 relative overflow-hidden">
              {/* Waiting overlay */}
              {collab.status === 'waiting-approval' && (
                <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center ${isDark ? 'bg-[#1e1e2e]/90' : 'bg-[#eff1f5]/90'} backdrop-blur-sm`}>
                  <div className="mb-4">
                    <Users size={32} className="text-[#CAA4F7]" />
                  </div>
                  <p className={`text-sm font-medium ${textPrimary}`}>Waiting for host approval...</p>
                  <p className={`text-xs mt-1 ${textMuted}`}>The room host will accept or reject your request.</p>
                  <button
                    onClick={collab.leaveRoom}
                    className="mt-4 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold hover:bg-red-500/25 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Collab editor for shared files, standard editor otherwise */}
              {isActiveFileShared && collab.provider && collab.status === 'connected' ? (
                <CollabMonacoEditor
                  file={activeFile}
                  theme={isDark ? 'dark' : 'light'}
                  fontSize={fontSize}
                  provider={collab.provider}
                  onChange={(code) => onCodeChange(activeFile.id, code)}
                  onCursorChange={(ln, col) => setCursorPosition({ ln, col })}
                  onSelectionChange={(count) => setSelectionCount(count)}
                />
              ) : (
                <ModernMonacoEditor
                  file={activeFile}
                  theme={isDark ? 'dark' : 'light'}
                  fontSize={fontSize}
                  onChange={(code) => onCodeChange(activeFile.id, code)}
                  onCursorChange={(ln, col) => setCursorPosition({ ln, col })}
                  onSelectionChange={(count) => setSelectionCount(count)}
                />
              )}
            </div>
          )}
        </div>

        {/* Chat side panel — flexes alongside editor */}
        {isInRoom && (
          <ChatPanel
            isOpen={isChatOpen}
            messages={collab.chatMessages}
            selfPeerId={collab.peerId}
            onSendMessage={collab.sendChatMessage}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>

      {/* Status bar */}
      <div className={`h-8 flex items-center justify-between px-2 sm:px-4 text-[10px] sm:text-[12px] kode-font font-black ${isDark ? 'bg-[#181821] text-white/70' : 'bg-[#DBDFE7] text-slate-500/30'} relative`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 h-4">
            <FileCode size={14} className="hidden sm:block" />
            <span>{files.length} FILES</span>
          </div>
          {activeFile && (
            <div className="flex items-center animate-fade-in">
              <div className={`flex items-center gap-2 h-6 transition-colors ${isDark ? 'text-white/70' : 'text-slate-500/30'}`}>
                <LanguageIcon language={activeFile.language} size={14} colorOverride="text-current opacity-70" />
                <span>{activeFile.language ? activeFile.language.toUpperCase() : 'AUTO DETECTING...'}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeFile && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 h-4">
                <Code2 size={14} className="hidden sm:block" />
                <span>LN {cursorPosition.ln}, COL {cursorPosition.col} <span className="hidden sm:inline">{selectionCount > 0 && `(${selectionCount} selected)`}</span></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collab bar */}
      {isInRoom && collab.roomId && (
        <CollabBar
          roomId={collab.roomId}
          status={collab.status}
          isHost={collab.isHost}
          members={collab.members}
          pending={collab.pending}
          toasts={collab.toasts}
          onApprove={collab.approveJoin}
          onReject={collab.rejectJoin}
          onLeave={collab.leaveRoom}
          onDismissToast={collab.dismissToast}
        />
      )}

      {/* Collab toasts — always rendered so rejection/error toasts are visible */}
      {collab.toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 pointer-events-none">
          {collab.toasts.map(toast => (
            <div
              key={toast.id}
              className={`pointer-events-auto relative flex items-center gap-3 pl-4 pr-3 py-3 min-w-[260px] max-w-[380px] rounded-2xl shadow-2xl text-[12px] font-semibold overflow-hidden
                ${toast.exiting ? 'animate-toast-out' : 'animate-toast-in'}
                ${
                  toast.type === 'error'   ? 'bg-[#3a1a1e]/90 text-[#ff8fa3] border border-[#ff4d6d]/25' :
                  toast.type === 'success' ? 'bg-[#1a2e1e]/90 text-[#8fd9a8] border border-[#4ade80]/25' :
                  toast.type === 'warning' ? 'bg-[#2e2510]/90 text-[#fcd34d] border border-[#fbbf24]/25' :
                  isDark
                    ? 'bg-[#1e1e2e]/90 text-[#cdd6f4] border border-[#45475a]/60'
                    : 'bg-white/90 text-[#1e1e2e] border border-slate-200/80'
                } backdrop-blur-xl`}
            >
              {/* Icon */}
              <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-[14px] ${
                toast.destination === 'collab'  ? 'bg-purple-500/20' :
                toast.destination === 'myfiles' ? 'bg-blue-500/20'   :
                toast.type === 'error'          ? 'bg-red-500/20'     :
                toast.type === 'success'        ? 'bg-green-500/20'   :
                toast.type === 'warning'        ? 'bg-amber-500/20'   :
                'bg-slate-500/20'
              }`}>
                {toast.destination === 'collab'  ? '⚡' :
                 toast.destination === 'myfiles' ? '📁' :
                 toast.type === 'error'          ? '✕'  :
                 toast.type === 'success'        ? '✓'  :
                 toast.type === 'warning'        ? '!'  : 'ℹ'}
              </div>

              {/* Text block */}
              <div className="flex-1 min-w-0">
                {/* File name — prominent */}
                {toast.fileName && (
                  <div className={`truncate font-bold text-[11px] mb-0.5 ${
                    toast.destination === 'collab'  ? 'text-purple-300' :
                    toast.destination === 'myfiles' ? 'text-blue-300'   :
                    'opacity-90'
                  }`}>
                    {toast.fileName}
                  </div>
                )}
                {/* Message + destination badge */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="leading-snug opacity-80">{toast.message}</span>
                  {toast.destination && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase ${
                      toast.destination === 'collab'
                        ? 'bg-purple-500/25 text-purple-300 border border-purple-500/30'
                        : 'bg-blue-500/25 text-blue-300 border border-blue-500/30'
                    }`}>
                      {toast.destination === 'collab' ? '⚡ Collab' : '📁 My Files'}
                    </span>
                  )}
                </div>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => collab.dismissToast(toast.id)}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/10 transition-all active:scale-90 opacity-40 hover:opacity-100"
              >
                <X size={12} />
              </button>

              {/* Progress drain bar */}
              {!toast.exiting && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-2xl overflow-hidden">
                  <div
                    className={`h-full rounded-b-2xl origin-left ${
                      toast.type === 'error'   ? 'bg-[#ff4d6d]/50' :
                      toast.type === 'success' ? 'bg-[#4ade80]/50' :
                      toast.type === 'warning' ? 'bg-[#fbbf24]/50' :
                      'bg-[#CAA4F7]/50'
                    }`}
                    style={{ animation: 'toastDrain 4s linear forwards' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
