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
  packageJson: string;
  requirements: string;
  envKeys: string[];
  structure: string[];
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

export interface ActiveFilePayload {
  path: string;
  content: string;
  language: string;
}

export interface OpenFilePayload {
  path: string;
  content: string;
  language: string;
}

export interface ContextPayload {
  source: 'vscode';
  workspaceId: string;
  timestamp: number;
  vscode: {
    activeFile: ActiveFilePayload | null;
    openFiles: OpenFilePayload[];
    git?: { branch: string };
  };
}

export interface SaveResponse {
  ok: boolean;
  message?: string;
}
