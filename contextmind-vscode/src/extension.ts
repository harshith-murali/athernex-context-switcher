import * as vscode from 'vscode';
import { captureContext } from './capture';
import { buildAndSend, fetchWorkspaces } from './bridge';
import { log } from './utils';

const WORKSPACE_KEY    = 'contextmind_workspace';
const COMMAND_SAVE     = 'contextmind.saveContext';
const COMMAND_SHOW_WID = 'contextmind.showWorkspaceId';
const COMMAND_SET_WID  = 'contextmind.setWorkspaceId';
const COMMAND_RESET    = 'contextmind.resetSession';
const STATUS_IDLE      = '$(save) Save Context';
const STATUS_BUSY      = '$(sync~spin) Saving…';

async function getOrCreateWorkspaceId(context: vscode.ExtensionContext): Promise<string> {
  let workspaces: any[];
  try {
    workspaces = await fetchWorkspaces();
  } catch (err: any) {
    if (err.message === "Not synced") {
      vscode.window.showErrorMessage("❌ Please open the ContextMind Chrome Extension once to sync your account locally.");
      throw new Error("Local account not synced");
    }
    throw err;
  }

  if (workspaces.length === 0) {
    vscode.window.showErrorMessage("❌ No workspaces found. Create one in the Chrome extension first.");
    throw new Error("No workspaces available");
  }

  const items: (vscode.QuickPickItem & { workspaceId: string })[] = workspaces.map((w: any) => ({
    label: w.name,
    description: w.workspaceId.slice(0, 8) + '...',
    workspaceId: w.workspaceId
  }));

  const lastWid = context.globalState.get<string>(WORKSPACE_KEY);
  if (lastWid) {
    const lastUsed = items.find(i => i.workspaceId === lastWid);
    if (lastUsed) {
      lastUsed.detail = "(Last used)";
      items.sort((a, b) => a === lastUsed ? -1 : b === lastUsed ? 1 : 0);
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a ContextMind workspace to save context to',
    ignoreFocusOut: true
  });

  if (!selected) {
    throw new Error('Workspace selection cancelled.');
  }

  const wid = selected.workspaceId;
  await context.globalState.update(WORKSPACE_KEY, wid);
  log.info(`✅ Selected workspace: ${wid}`);
  return wid;
}

export function activate(context: vscode.ExtensionContext): void {
  log.info('ContextMind is now active.');

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text    = STATUS_IDLE;
  statusBar.tooltip = 'ContextMind · Click to save your current context';
  statusBar.command = COMMAND_SAVE;
  statusBar.show();

  // ── Save Context ──────────────────────────────────────────────
  const saveCmd = vscode.commands.registerCommand(COMMAND_SAVE, async () => {
    try {
      const workspaceId  = await getOrCreateWorkspaceId(context);
      statusBar.text = STATUS_BUSY;
      const vscodeCtx    = await captureContext();
      const result       = await buildAndSend(vscodeCtx, workspaceId);

      if (result.ok) {
        vscode.window.showInformationMessage(`✅ Context saved  |  Workspace: ${workspaceId.slice(0, 8)}…`);
      } else {
        vscode.window.showErrorMessage(`❌ Failed to save context: ${result.message}`);
      }
    } catch (err: unknown) {
      log.error('Save aborted or failed.', err);
      if (err instanceof Error && err.message !== 'Workspace selection cancelled.' && err.message !== 'Local account not synced' && err.message !== 'No workspaces available') {
        vscode.window.showErrorMessage('❌ Failed to save context');
      }
    } finally {
      statusBar.text = STATUS_IDLE;
    }
  });

  // ── Show Workspace ID ─────────────────────────────────────────
  const showCmd = vscode.commands.registerCommand(COMMAND_SHOW_WID, async () => {
    const wid = await getOrCreateWorkspaceId(context);
    const choice = await vscode.window.showInformationMessage(
      `ContextMind Workspace ID:\n${wid}`,
      'Copy to Clipboard',
      'Close'
    );
    if (choice === 'Copy to Clipboard') {
      await vscode.env.clipboard.writeText(wid);
      vscode.window.showInformationMessage('✅ Workspace ID copied!');
    }
  });

  // ── Set Workspace ID ──────────────────────────────────────────
  const setCmd = vscode.commands.registerCommand(COMMAND_SET_WID, async () => {
    const input = await vscode.window.showInputBox({
      prompt:        'Paste a Workspace ID to sync with the Chrome extension.',
      placeHolder:   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      ignoreFocusOut: true
    });
    if (input?.trim()) {
      await context.globalState.update(WORKSPACE_KEY, input.trim());
      vscode.window.showInformationMessage(`✅ Workspace synced: ${input.trim().slice(0, 8)}…`);
    }
  });

  // ── Reset Workspace ───────────────────────────────────────────
  const resetCmd = vscode.commands.registerCommand(COMMAND_RESET, async () => {
    await context.globalState.update(WORKSPACE_KEY, undefined);
    vscode.window.showInformationMessage('Workspace selection reset. Next time you save, you will be prompted to pick a workspace.');
  });

  context.subscriptions.push(saveCmd, showCmd, setCmd, resetCmd, statusBar);
}

export function deactivate(): void {
  log.info('ContextMind deactivated.');
}
