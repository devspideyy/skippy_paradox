/**
 * Judge0 Service — Code execution via Judge0 API through backend proxy.
 */

const RAW_API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();
const NORMALIZED_API_URL = RAW_API_URL.replace(/\/+$/, '');
const API_BASE = NORMALIZED_API_URL
  ? (NORMALIZED_API_URL.endsWith('/api') ? NORMALIZED_API_URL : `${NORMALIZED_API_URL}/api`)
  : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? 'https://skiffy.onrender.com/api'
      : '/api');

export interface ExecutionRequest {
  source_code: string;
  language: string;
  stdin?: string;
  expected_output?: string;
}

export interface ExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

export interface Language {
  id: number;
  name: string;
  display: string;
}

/**
 * Execute code using Judge0.
 */
export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${API_BASE}/api/judge0/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    // Backend offline or error, try socket server
  }

  try {
    const socketServerUrl = import.meta.env.VITE_COLLAB_URL || 'http://localhost:4000';
    const socketHttpUrl = socketServerUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
    const socketRes = await fetch(`${socketHttpUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (socketRes.ok) {
      return await socketRes.json();
    }
  } catch (err) {
    // Socket server offline, continue to client-side fallback
  }

  // Client-side execution fallback for JavaScript/TypeScript
  const lang = request.language.toLowerCase();
  if (['javascript', 'js', 'typescript', 'ts'].includes(lang)) {
    let capturedLogs: string[] = [];
    let capturedErrors: string[] = [];

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      originalLog(...args);
    };
    console.error = (...args: any[]) => {
      capturedErrors.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      originalError(...args);
    };
    console.warn = (...args: any[]) => {
      capturedLogs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      originalWarn(...args);
    };

    let statusId = 3;
    let desc = 'Accepted';

    try {
      // Execute within safe Function context
      const runFn = new Function(request.source_code);
      const res = runFn();
      if (res !== undefined && capturedLogs.length === 0) {
        capturedLogs.push(String(res));
      }
    } catch (e: any) {
      statusId = 4;
      desc = 'Runtime Error';
      capturedErrors.push(e.stack || e.message || String(e));
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(3) + 's';

    return {
      stdout: capturedLogs.length > 0 ? capturedLogs.join('\n') : null,
      stderr: capturedErrors.length > 0 ? capturedErrors.join('\n') : null,
      compile_output: null,
      message: null,
      status: { id: statusId, description: desc },
      time: elapsed,
      memory: 512,
    };
  }

  throw new Error(`Execution service unavailable. Please start backend on ${API_BASE} or use JavaScript.`);
}

/**
 * Get list of supported languages.
 */
export async function getSupportedLanguages(): Promise<Language[]> {
  const response = await fetch(`${API_BASE}/judge0/languages`);

  if (!response.ok) {
    throw new Error('Failed to fetch supported languages');
  }

  const data = await response.json();
  return data.languages;
}

/**
 * Check Judge0 API status.
 */
export async function getJudge0Status(): Promise<{ status: string; judge0?: any; message?: string }> {
  const response = await fetch(`${API_BASE}/judge0/status`);

  if (!response.ok) {
    throw new Error('Failed to check Judge0 status');
  }

  return response.json();
}

/**
 * Map Monaco editor language to Judge0 language identifier.
 */
export function mapMonacoLanguageToJudge0(monacoLang: string): string {
  const mapping: Record<string, string> = {
    'javascript': 'javascript',
    'typescript': 'typescript',
    'python': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'csharp': 'csharp',
    'go': 'go',
    'rust': 'rust',
    'ruby': 'ruby',
    'php': 'php',
    'kotlin': 'kotlin',
    'swift': 'swift',
    'r': 'r',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
  };

  return mapping[monacoLang.toLowerCase()] || monacoLang;
}
