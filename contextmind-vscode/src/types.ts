// ─────────────────────────────────────────────────────────────
//  ContextMind · types.ts
//  Canonical payload interfaces shared across all modules.
// ─────────────────────────────────────────────────────────────

export type FileType = 'active' | 'supporting';

export interface CapturedFile {
  path: string;
  language: string;
  content: string;
  type: FileType;
}

export interface CursorPosition {
  file: string;
  line: number;
  character: number;
}

export interface Layer1Context {
  packageJson: string;   // raw JSON string or ''
  requirements: string;  // raw text or ''
  envKeys: string[];     // only key names, never values
  structure: string[];   // shallow file listing, max ~50 entries
}

export interface VSCodeContext {
  files: CapturedFile[];
  cursor: CursorPosition;
  selectedText: string;
  gitBranch: string;
  diff: string;
  workspaceName: string;
  layer1: Layer1Context;
  diagnostics?: DiagnosticEntry[];
  recentFiles?: string[];
}

export interface DiagnosticEntry {
  file: string;
  severity: 'Error' | 'Warning' | 'Information' | 'Hint';
  message: string;
  line: number;
}

export interface ContextPayload {
  source: 'vscode';
  sessionId: string;   // vscode.env.sessionId — matches Chrome extension session
  timestamp: number;
  vscode: VSCodeContext;
}

export interface SaveResponse {
  ok: boolean;
  message?: string;
}
