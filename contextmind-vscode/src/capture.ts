// ─────────────────────────────────────────────────────────────
//  ContextMind · capture.ts
//  Captures the full VS Code developer context:
//    • active file (content around cursor)
//    • supporting open files (first 100 lines)
//    • cursor position
//    • selected text
//    • workspace diagnostics (errors/warnings)
//    • recently opened files
// ─────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import * as path from 'path';
import {
  CapturedFile,
  CursorPosition,
  DiagnosticEntry,
  VSCodeContext,
} from './types';
import { extractLinesAroundCursor, firstNLines, log } from './utils';
import { getGitBranch, getGitDiff } from './git';
import { captureLayer1 } from './layer1';

const SUPPORTING_LINE_LIMIT = 100;
const CONTEXT_LINES_ABOVE   = 100;
const CONTEXT_LINES_BELOW   = 100;

// ─── Active File ──────────────────────────────────────────────

function captureActiveFile(editor: vscode.TextEditor): CapturedFile {
  const doc     = editor.document;
  const content = doc.getText();
  const cursor  = editor.selection.active;

  const sliced = extractLinesAroundCursor(
    content,
    cursor.line,
    CONTEXT_LINES_ABOVE,
    CONTEXT_LINES_BELOW,
  );

  return {
    path:     doc.uri.fsPath,
    language: doc.languageId,
    content:  sliced,
    type:     'active',
  };
}

// ─── Supporting Files ─────────────────────────────────────────

function captureSupportingFiles(
  activeUri: string,
): CapturedFile[] {
  const results: CapturedFile[] = [];

  for (const doc of vscode.workspace.textDocuments) {
    if (doc.uri.scheme !== 'file')   { continue; }
    if (doc.isUntitled)              { continue; }
    if (doc.uri.fsPath === activeUri){ continue; }

    const content = firstNLines(doc.getText(), SUPPORTING_LINE_LIMIT);
    results.push({
      path:     doc.uri.fsPath,
      language: doc.languageId,
      content,
      type: 'supporting',
    });
  }

  return results;
}

// ─── Cursor Position ──────────────────────────────────────────

function captureCursor(editor: vscode.TextEditor): CursorPosition {
  const pos = editor.selection.active;
  return {
    file:      editor.document.uri.fsPath,
    line:      pos.line,
    character: pos.character,
  };
}

// ─── Selected Text ────────────────────────────────────────────

function captureSelection(editor: vscode.TextEditor): string {
  const sel = editor.selection;
  if (sel.isEmpty) { return ''; }
  return editor.document.getText(sel);
}

// ─── Diagnostics ──────────────────────────────────────────────

function captureDiagnostics(): DiagnosticEntry[] {
  const severityMap: Record<number, DiagnosticEntry['severity']> = {
    [vscode.DiagnosticSeverity.Error]:       'Error',
    [vscode.DiagnosticSeverity.Warning]:     'Warning',
    [vscode.DiagnosticSeverity.Information]: 'Information',
    [vscode.DiagnosticSeverity.Hint]:        'Hint',
  };

  const entries: DiagnosticEntry[] = [];

  for (const [uri, diags] of vscode.languages.getDiagnostics()) {
    if (uri.scheme !== 'file') { continue; }
    for (const d of diags) {
      entries.push({
        file:     uri.fsPath,
        severity: severityMap[d.severity] ?? 'Information',
        message:  d.message,
        line:     d.range.start.line,
      });
    }
  }

  return entries;
}

// ─── Recent Files ─────────────────────────────────────────────

async function captureRecentFiles(): Promise<string[]> {
  try {
    // VS Code exposes recently opened via a private API; use a safe fallback
    const items = await vscode.commands.executeCommand<
      { fileUri?: vscode.Uri; label?: string }[]
    >('_workbench.getRecentlyOpened');

    if (!items || !Array.isArray(items)) { return []; }

    return items
      .filter(i => i.fileUri)
      .map(i => i.fileUri!.fsPath)
      .slice(0, 10);
  } catch {
    return [];
  }
}

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Collect the full developer context snapshot and return it
 * as a structured VSCodeContext object ready for the bridge.
 */
export async function captureContext(): Promise<VSCodeContext> {
  const editor = vscode.window.activeTextEditor;

  // ── Active file ──
  const activeFile = editor ? captureActiveFile(editor) : null;
  const activeUri  = editor?.document.uri.fsPath ?? '';

  // ── Supporting open files ──
  const supporting = captureSupportingFiles(activeUri);

  const files = activeFile
    ? [activeFile, ...supporting]
    : supporting;

  // ── Cursor & selection ──
  const cursor       = editor ? captureCursor(editor)   : { file: '', line: 0, character: 0 };
  const selectedText = editor ? captureSelection(editor) : '';

  // ── Workspace root ──
  const rootFolder  = vscode.workspace.workspaceFolders?.[0];
  const workspaceRoot = rootFolder?.uri.fsPath ?? '';
  const workspaceName = rootFolder?.name ?? path.basename(workspaceRoot) ?? 'unknown';

  // ── Git ──
  let gitBranch = 'unknown';
  let diff      = '';
  if (workspaceRoot) {
    log.info('Collecting git context…');
    gitBranch = getGitBranch(workspaceRoot);
    diff      = getGitDiff(workspaceRoot);
  }

  // ── Layer-1 ──
  const layer1 = workspaceRoot
    ? await captureLayer1(workspaceRoot)
    : { packageJson: '', requirements: '', envKeys: [], structure: [] };

  // ── Diagnostics ──
  const diagnostics = captureDiagnostics();

  // ── Recent files ──
  const recentFiles = await captureRecentFiles();

  log.info(
    `Context captured: ${files.length} file(s), ` +
    `${diagnostics.length} diagnostic(s), ` +
    `branch="${gitBranch}"`,
  );

  return {
    files,
    cursor,
    selectedText,
    gitBranch,
    diff,
    workspaceName,
    layer1,
    diagnostics,
    recentFiles,
  };
}
