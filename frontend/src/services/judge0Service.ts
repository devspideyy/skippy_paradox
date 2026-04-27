/**
 * Judge0 Service — Code execution via Judge0 API through backend proxy.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  const response = await fetch(`${API_BASE}/api/judge0/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Execution failed' }));
    throw new Error(error.detail || 'Failed to execute code');
  }

  return response.json();
}

/**
 * Get list of supported languages.
 */
export async function getSupportedLanguages(): Promise<Language[]> {
  const response = await fetch(`${API_BASE}/api/judge0/languages`);

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
  const response = await fetch(`${API_BASE}/api/judge0/status`);

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
