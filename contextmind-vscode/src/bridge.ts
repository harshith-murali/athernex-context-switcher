import { VSCodeContext, ContextPayload, SaveResponse } from './types';
import { log } from './utils';

const BASE_URL   = 'http://localhost:37218';
const TIMEOUT_MS = 10_000;
const CONTENT_MAX = 2000;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

async function post(path: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch local workspaces from the local Express backend (synced via Chrome extension).
 */
export async function fetchWorkspaces(): Promise<any[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/local/workspaces`, { signal: controller.signal });
    if (res.status === 401) {
      throw new Error("Not synced");
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch workspaces: HTTP ${res.status}`);
    }
    const data = await res.json() as { workspaces: any[] };
    return data.workspaces;
  } finally {
    clearTimeout(timer);
  }
}


/**
 * POST the captured context to /save.
 */
export async function sendContext(payload: ContextPayload): Promise<SaveResponse> {
  try {
    log.info(`🚀 Sending payload (workspace: ${payload.workspaceId})`);
    const res = await post('/save', payload);

    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      log.error(`❌ Backend HTTP ${res.status}: ${text}`);
      return { ok: false, message: `Server error ${res.status}: ${text}` };
    }

    log.info('✅ Payload accepted.');
    return { ok: true, message: 'Context saved.' };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      log.error('⏱️ Request timed out.');
      return { ok: false, message: 'Request timed out after 10 s.' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    log.error('❌ Network error:', err);
    return { ok: false, message: `Network error: ${msg}` };
  }
}

/**
 * Transform captured VSCodeContext into the workspace-based payload and send.
 */
export async function buildAndSend(
  ctx: VSCodeContext,
  workspaceId: string
): Promise<SaveResponse> {
  const activeRaw = ctx.files.find(f => f.type === 'active') ?? null;
  const openRaw   = ctx.files.filter(f => f.type === 'supporting');

  const payload: ContextPayload = {
    source:      'vscode',
    workspaceId,
    timestamp:   Date.now(),
    vscode: {
      activeFile: activeRaw
        ? {
            path:     activeRaw.path,
            content:  truncate(activeRaw.content, CONTENT_MAX),
            language: activeRaw.language
          }
        : null,
      openFiles: openRaw.map(f => ({
        path:     f.path,
        content:  truncate(f.content, CONTENT_MAX),
        language: f.language
      })),
      git: ctx.gitBranch ? { branch: ctx.gitBranch } : undefined
    }
  };

  return sendContext(payload);
}
