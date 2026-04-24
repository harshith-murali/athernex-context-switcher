// ─────────────────────────────────────────────────────────────
//  ContextMind · bridge.ts
//  Sends the captured context payload to the FastAPI backend.
//  No local storage. MongoDB is handled entirely by the backend.
// ─────────────────────────────────────────────────────────────

import { ContextPayload, SaveResponse } from './types';
import { log } from './utils';
import * as vscode from 'vscode';

const BACKEND_URL = 'http://localhost:37218/save';
const TIMEOUT_MS  = 10_000;

/**
 * POST the context payload to the backend.
 * Returns a SaveResponse indicating success or failure.
 * Never throws — all errors are caught and surfaced via the return value.
 */
export async function sendContext(payload: ContextPayload): Promise<SaveResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    log.info(`Sending payload to ${BACKEND_URL} …`);

    const response = await fetch(BACKEND_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '<no body>');
      log.error(`Backend returned HTTP ${response.status}: ${text}`);
      return {
        ok:      false,
        message: `Server error ${response.status}: ${text}`,
      };
    }

    // Try to parse JSON; fall back gracefully
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    log.info('Payload accepted by backend.');
    return {
      ok:      true,
      message: (body['message'] as string | undefined) ?? 'Context saved.',
    };

  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === 'AbortError') {
      log.error('Request timed out.');
      return { ok: false, message: 'Request timed out after 10 s.' };
    }

    const message = err instanceof Error ? err.message : String(err);
    log.error('Network error while sending context.', err);
    return { ok: false, message: `Network error: ${message}` };
  }
}

/**
 * Build the root-level payload envelope and delegate to sendContext.
 */
export async function buildAndSend(
  vscodeContext: import('./types').VSCodeContext,
): Promise<SaveResponse> {
  const payload: ContextPayload = {
    source:    'vscode',
    sessionId: vscode.env.sessionId,
    timestamp: Date.now(),
    vscode:    vscodeContext,
  };

  console.log('[ContextMind] payload:', JSON.stringify(payload, null, 2));
  return sendContext(payload);
}
