// ─────────────────────────────────────────────────────────────
//  ContextMind · extension.ts
//  Entry point: registers commands, builds the status-bar button,
//  and wires everything together.
// ─────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { captureContext } from './capture';
import { buildAndSend } from './bridge';
import { log } from './utils';

// ── Constants ────────────────────────────────────────────────
const COMMAND_ID   = 'contextmind.saveContext';
const STATUS_TEXT  = '$(save) Save Context';
const STATUS_SAVING = '$(sync~spin) Saving…';
const STATUS_TOOLTIP = 'ContextMind · Click to save your current context';

// ── Extension activate ────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  log.info('ContextMind is now active.');

  // ── Status-bar button ──
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBar.text    = STATUS_TEXT;
  statusBar.tooltip = STATUS_TOOLTIP;
  statusBar.command = COMMAND_ID;
  statusBar.show();

  // ── Command: contextmind.saveContext ──
  const saveCommand = vscode.commands.registerCommand(COMMAND_ID, async () => {
    // Optimistic UI: update status bar immediately
    statusBar.text    = STATUS_SAVING;
    statusBar.tooltip = 'ContextMind · Capturing context…';

    try {
      log.info('Save Context triggered.');

      // 1. Capture
      const vscodeContext = await captureContext();

      // 2. Send
      const result = await buildAndSend(vscodeContext);

      if (result.ok) {
        log.info('Context saved successfully.');
        vscode.window.showInformationMessage('✅ Context saved');
      } else {
        log.warn(`Save failed: ${result.message}`);
        vscode.window.showErrorMessage('❌ Failed to save context');
      }
    } catch (err: unknown) {
      log.error('Unexpected error during save.', err);
      vscode.window.showErrorMessage('❌ Failed to save context');
    } finally {
      // Restore status bar
      statusBar.text    = STATUS_TEXT;
      statusBar.tooltip = STATUS_TOOLTIP;
    }
  });

  // Register disposables so VS Code cleans up on deactivate
  context.subscriptions.push(saveCommand, statusBar);
}

// ── Extension deactivate ─────────────────────────────────────

export function deactivate(): void {
  log.info('ContextMind deactivated.');
}
