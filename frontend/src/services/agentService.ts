/**
 * Agent Harness Service for Skiffy
 * Supports OpenRouter & Gemini with full Tool Calling (Read, Write, List, Execute Code)
 */

import { executeCode } from './judge0Service';
import { getStoredFiles, saveFiles, StoredFile, computeContentHash } from './storageService';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AgentStep {
  id: string;
  type: 'thought' | 'tool_call' | 'tool_result' | 'file_edit' | 'error';
  title: string;
  details?: string;
  status: 'running' | 'success' | 'failed';
  timestamp: number;
}

export interface AgentExecutionCallback {
  onStep: (step: AgentStep) => void;
  onUpdateFile: (fileId: string, content: string) => void;
  onCreateFile: (name: string, content: string, language: string) => void;
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'list_files',
    description: 'Lists all files in the current workspace with their filenames, paths, and languages.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_file',
    description: 'Reads the full content of a file in the workspace by filename or path.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name or path of the file to read' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'write_file',
    description: 'Creates a new file or overwrites an existing file with the provided content.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name or path of the file to write' },
        content: { type: 'string', description: 'The complete code or text to write' },
        language: { type: 'string', description: 'Language of the file (e.g. javascript, python, typescript, html)' },
      },
      required: ['filename', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Replaces an exact targeted string in an existing file with new content.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name or path of the file to edit' },
        old_string: { type: 'string', description: 'Exact string to be replaced' },
        new_string: { type: 'string', description: 'Replacement string' },
      },
      required: ['filename', 'old_string', 'new_string'],
    },
  },
  {
    name: 'search_files',
    description: 'Searches for text or regex pattern across all workspace files.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query text or pattern to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'execute_code',
    description: 'Executes code in Python, JavaScript, TypeScript, or other supported languages and returns stdout/stderr output.',
    parameters: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'Language of code to run (python, javascript, etc.)' },
        code: { type: 'string', description: 'Code to execute' },
        stdin: { type: 'string', description: 'Optional standard input' },
      },
      required: ['language', 'code'],
    },
  },
];

/**
 * Execute a local tool called by the agent
 */
export async function executeAgentTool(
  name: string,
  args: any,
  callbacks: AgentExecutionCallback
): Promise<any> {
  const files = getStoredFiles();

  switch (name) {
    case 'list_files': {
      return files.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path || f.name,
        language: f.language,
        size: f.content?.length || 0,
      }));
    }

    case 'read_file': {
      const targetName = (args.filename || '').trim().toLowerCase();
      const found = files.find(f => f.name.toLowerCase() === targetName || (f.path && f.path.toLowerCase().endsWith(targetName)));
      if (!found) {
        return { error: `File '${args.filename}' not found. Available files: ${files.map(f => f.name).join(', ')}` };
      }
      return {
        filename: found.name,
        language: found.language,
        content: found.content,
      };
    }

    case 'write_file': {
      const filename = args.filename.trim();
      const content = args.content;
      const lang = args.language || 'plaintext';

      const existingIndex = files.findIndex(f => f.name.toLowerCase() === filename.toLowerCase());
      if (existingIndex >= 0) {
        const file = files[existingIndex];
        file.content = content;
        file.contentHash = computeContentHash(content);
        file.lastModified = Date.now();
        if (args.language) file.language = args.language;
        saveFiles(files);
        callbacks.onUpdateFile(file.id, content);
        return { success: true, message: `Updated file ${filename}` };
      } else {
        const newId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newFile: StoredFile = {
          id: newId,
          name: filename,
          content,
          language: lang,
          contentHash: computeContentHash(content),
          lastModified: Date.now(),
        };
        files.push(newFile);
        saveFiles(files);
        callbacks.onCreateFile(filename, content, lang);
        return { success: true, message: `Created new file ${filename}`, fileId: newId };
      }
    }

    case 'edit_file': {
      const filename = (args.filename || '').trim().toLowerCase();
      const file = files.find(f => f.name.toLowerCase() === filename || (f.path && f.path.toLowerCase().endsWith(filename)));
      if (!file) {
        return { error: `File '${args.filename}' not found.` };
      }

      const oldStr = args.old_string;
      const newStr = args.new_string;

      if (!file.content.includes(oldStr)) {
        return { error: `Could not find exact text match to replace in ${file.name}.` };
      }

      file.content = file.content.replace(oldStr, newStr);
      file.contentHash = computeContentHash(file.content);
      file.lastModified = Date.now();
      saveFiles(files);
      callbacks.onUpdateFile(file.id, file.content);
      return { success: true, message: `Successfully updated ${file.name}` };
    }

    case 'search_files': {
      const q = (args.query || '').toLowerCase();
      const results: Array<{ file: string; line: number; text: string }> = [];

      for (const f of files) {
        const lines = (f.content || '').split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(q)) {
            results.push({
              file: f.name,
              line: idx + 1,
              text: line.trim(),
            });
          }
        });
      }

      return {
        query: args.query,
        matchCount: results.length,
        matches: results.slice(0, 30),
      };
    }

    case 'execute_code': {
      const res = await executeCode({
        source_code: args.code,
        language: args.language || 'javascript',
        stdin: args.stdin,
      });

      return {
        status: res.status.description,
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        executionTime: res.time,
      };
    }

    default:
      return { error: `Unknown tool '${name}'` };
  }
}

/**
 * Run Autonomous Agent Loop with Gemini or OpenRouter
 */
export async function runAgentLoop({
  prompt,
  apiKey,
  provider = 'gemini',
  model = 'gemini-2.0-flash',
  openRouterBaseUrl = 'https://openrouter.ai/api/v1',
  callbacks,
  signal,
}: {
  prompt: string;
  apiKey: string;
  provider?: 'gemini' | 'openrouter';
  model?: string;
  openRouterBaseUrl?: string;
  callbacks: AgentExecutionCallback;
  signal?: AbortSignal;
}): Promise<string> {
  const MAX_ITERATIONS = 8;
  let iterations = 0;

  if (provider === 'openrouter') {
    // OpenRouter (OpenAI-compatible) Tool Calling Loop
    const messages: any[] = [
      {
        role: 'system',
        content: `You are Skiff, an autonomous senior coding agent. You can read, write, list files, and execute code using tools. Make changes, run tests or code to verify correctness, and iterate until the task is complete.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const openRouterTools = AGENT_TOOLS.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    let activeModel = model || 'nvidia/nemotron-3.5-lightning:free';

    while (iterations < MAX_ITERATIONS) {
      if (signal?.aborted) throw new Error('Agent execution cancelled');
      iterations++;

      let res = await fetch(`${openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Skiff Coding Agent',
        },
        signal,
        body: JSON.stringify({
          model: activeModel,
          messages,
          tools: openRouterTools,
          tool_choice: 'auto',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = err.error?.message || `OpenRouter API error ${res.status}`;
        
        // If the model fails due to lack of credits or no endpoints found, fallback to Nemotron free
        if (activeModel !== 'nvidia/nemotron-3.5-lightning:free' && (errMsg.includes('endpoints') || errMsg.includes('credits') || res.status === 402 || res.status === 403)) {
          callbacks.onStep({
            id: `fallback-${Date.now()}`,
            type: 'thought',
            title: `Switching to nvidia/nemotron-3.5-lightning:free`,
            details: `Model ${activeModel} unavailable on current key tier (${errMsg}). Auto-switching to Nemotron free model.`,
            status: 'running',
            timestamp: Date.now(),
          });
          activeModel = 'nvidia/nemotron-3.5-lightning:free';
          
          res = await fetch(`${openRouterBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Skiff Coding Agent',
            },
            signal,
            body: JSON.stringify({
              model: activeModel,
              messages,
              tools: openRouterTools,
              tool_choice: 'auto',
            }),
          });

          if (!res.ok) {
            const fallbackErr = await res.json().catch(() => ({}));
            throw new Error(fallbackErr.error?.message || `OpenRouter API error ${res.status}`);
          }
        } else {
          throw new Error(errMsg);
        }
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) break;
      messages.push(assistantMsg);

      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        for (const tc of assistantMsg.tool_calls) {
          const fnName = tc.function.name;
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch (e) {
            parsedArgs = {};
          }

          callbacks.onStep({
            id: tc.id,
            type: 'tool_call',
            title: `Executing: ${fnName}`,
            details: JSON.stringify(parsedArgs, null, 2),
            status: 'running',
            timestamp: Date.now(),
          });

          let toolResult = null;
          try {
            toolResult = await executeAgentTool(fnName, parsedArgs, callbacks);
            callbacks.onStep({
              id: `${tc.id}-done`,
              type: 'tool_result',
              title: `Completed ${fnName}`,
              details: JSON.stringify(toolResult, null, 2),
              status: 'success',
              timestamp: Date.now(),
            });
          } catch (toolErr: any) {
            toolResult = { error: toolErr.message || String(toolErr) };
            callbacks.onStep({
              id: `${tc.id}-err`,
              type: 'error',
              title: `Error in ${fnName}`,
              details: String(toolErr),
              status: 'failed',
              timestamp: Date.now(),
            });
          }

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult),
          });
        }
      } else {
        // Final response reached
        return assistantMsg.content || 'Task finished.';
      }
    }

    return 'Agent reached max turn limit.';
  } else {
    // Gemini Tool Calling Loop
    const contents: any[] = [
      {
        role: 'user',
        parts: [{ text: `You are Skiff, an autonomous coding agent. Use tools to list, read, write files, and execute code.\n\nTask: ${prompt}` }],
      },
    ];

    const geminiFunctionDeclarations = AGENT_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    while (iterations < MAX_ITERATIONS) {
      if (signal?.aborted) throw new Error('Agent execution cancelled');
      iterations++;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            contents,
            tools: [{ functionDeclarations: geminiFunctionDeclarations }],
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini API error ${res.status}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      contents.push({
        role: 'model',
        parts,
      });

      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length > 0) {
        const responseParts: any[] = [];

        for (const fcPart of functionCalls) {
          const fc = fcPart.functionCall;
          const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

          callbacks.onStep({
            id: stepId,
            type: 'tool_call',
            title: `Executing: ${fc.name}`,
            details: JSON.stringify(fc.args, null, 2),
            status: 'running',
            timestamp: Date.now(),
          });

          let toolOutput: any;
          try {
            toolOutput = await executeAgentTool(fc.name, fc.args, callbacks);
            callbacks.onStep({
              id: `${stepId}-done`,
              type: 'tool_result',
              title: `Completed ${fc.name}`,
              details: JSON.stringify(toolOutput, null, 2),
              status: 'success',
              timestamp: Date.now(),
            });
          } catch (e: any) {
            toolOutput = { error: e.message || String(e) };
            callbacks.onStep({
              id: `${stepId}-err`,
              type: 'error',
              title: `Error in ${fc.name}`,
              details: String(e),
              status: 'failed',
              timestamp: Date.now(),
            });
          }

          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: { result: toolOutput },
            },
          });
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });
      } else {
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
        return textParts || 'Task completed successfully.';
      }
    }

    return 'Agent reached step limit.';
  }
}
