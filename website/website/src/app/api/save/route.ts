import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { connectDB, Workspace } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { YoutubeTranscript } from 'youtube-transcript';

const CONTENT_MAX  = 50_000;
const CHAT_MSG_MAX = 100_000;
const MAX_MESSAGES = 60;

const AI_DOMAINS = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai'];
const NOISE = ['netflix.com', 'twitter.com', 'reddit.com', 'instagram.com', 'twitch.tv', 'spotify.com', 'tiktok.com'];

const TECH_RE = /\b(React|Vue|Angular|Next\.js|TypeScript|JavaScript|Python|FastAPI|Flask|Django|Node\.js|Express|MongoDB|PostgreSQL|MySQL|Redis|Docker|Kubernetes|AWS|Tailwind|GraphQL|REST|JWT|OAuth|Prisma|SQLite|Vite|Svelte|NestJS|Spring|Rails|Laravel|PHP|Go|Rust|Swift|Kotlin|Firebase|Supabase|Vercel|Netlify)\b/g;
const ERROR_RE = /\b(Error|Exception|TypeError|SyntaxError|ReferenceError|404|500|ENOENT|undefined is not|cannot read|failed to)\b/i;

function truncate(s: string | undefined | null, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

function fingerprint(content: string): string {
  const c = String(content).trim();
  return `${c.slice(0, 120)}|${c.slice(-60)}|${c.length}`;
}

function dedup(existing: any[], incoming: any[]): any[] {
  const seen = new Set(existing.map((m: any) => fingerprint(m.content)));
  return incoming.filter(m => !seen.has(fingerprint(m.content)));
}

function isUseful(url: string): boolean {
  return (
    !!url?.startsWith('http') &&
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.includes('localhost') &&
    !url.includes('127.0.0.1') &&
    !NOISE.some(d => url.includes(d))
  );
}

function isAI(url: string): boolean {
  return AI_DOMAINS.some(d => url.includes(d));
}

function buildSummary(messages: any[], existing: any): any {
  const firstUser = messages.find((m: any) => m.role === 'user');
  const goal = existing.goal || (firstUser ? firstUser.content.slice(0, 300) : '');

  const allText = messages.map((m: any) => String(m.content)).join(' ');
  const techSet = new Set<string>(existing.techStack || []);
  for (const match of allText.matchAll(TECH_RE)) techSet.add(match[0]);

  const decisions: string[] = [...(existing.decisions || [])];
  for (const m of messages) {
    if (m.role === 'assistant' && m.content.length > 150) {
      const firstLine = String(m.content).split('\n').find((l: string) => l.trim().length > 20);
      if (firstLine && !decisions.some(d => d.includes(firstLine.slice(0, 40)))) {
        decisions.push(firstLine.slice(0, 150));
      }
    }
  }

  const errorHistory: string[] = [...(existing.errorHistory || [])];
  for (const m of messages) {
    const match = ERROR_RE.exec(String(m.content));
    if (match) {
      const start = Math.max(0, match.index - 20);
      const err = String(m.content).slice(start, start + 180).trim();
      if (!errorHistory.some((e: string) => e.includes(match[0]))) errorHistory.push(err);
    }
  }

  const codeSnippets: string[] = [...(existing.codeSnippets || [])];
  const codeRe = /```[\s\S]*?```/g;
  for (const m of messages) {
    if (m.role === 'assistant') {
      for (const block of String(m.content).matchAll(codeRe)) {
        const code = block[0].slice(3, -3).replace(/^[a-z]+\n/, '').trim();
        if (code.length > 50 && codeSnippets.length < 6 && !codeSnippets.includes(code)) {
          codeSnippets.push(code.slice(0, 800));
        }
      }
    }
  }

  return {
    goal,
    progress: `${messages.length} messages captured`,
    techStack: Array.from(techSet).slice(0, 20),
    decisions: decisions.slice(-15),
    errorHistory: errorHistory.slice(-10),
    codeSnippets: codeSnippets.slice(-5),
  };
}

function appendMessages(chats: any, incoming: any[]): any {
  const existing = chats?.messages ?? [];
  const fresh = dedup(existing, incoming);
  if (fresh.length === 0) return chats;

  const all = [...existing, ...fresh].slice(-MAX_MESSAGES);
  return {
    messages: all,
    rollingSummary: buildSummary(all, chats?.rollingSummary ?? {}),
    lastSummarizedIndex: all.length,
  };
}

function upsertBrowserState(existing: any[], incoming: any[]): any[] {
  const map = new Map(existing.map((e) => [e.url, e]));
  for (const item of incoming) {
    const prev = map.get(item.url);
    if (!prev || item.lastSeen >= prev.lastSeen) map.set(item.url, item);
  }
  return Array.from(map.values());
}

function upsertCodeState(existing: any[], incoming: any[]): any[] {
  const map = new Map(existing.map((e) => [e.path, e]));
  for (const item of incoming) {
    const prev = map.get(item.path);
    if (!prev || item.lastSeen >= prev.lastSeen) map.set(item.path, item);
  }
  return Array.from(map.values());
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const hdrs = corsHeaders(origin);

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized — sign in at localhost:3000 first' }, { status: 401, headers: hdrs });
    }

    await connectDB();
    const body = await req.json();
    const { workspaceId, source, timestamp, chrome, vscode } = body;
    const now: number = timestamp ?? Date.now();

    let targetWorkspaceId = workspaceId;
    let workspace: any;

    if (targetWorkspaceId) {
      workspace = await Workspace.findOne({ workspaceId: targetWorkspaceId, userId });
    }
    if (!workspace) {
      workspace = await Workspace.findOne({ userId }).sort({ lastUpdated: -1 });
      if (!workspace) {
        const newId = uuidv4();
        workspace = new Workspace({
          workspaceId: newId,
          userId,
          name: source === 'chrome' ? 'My Workspace (Chrome)' : 'My Workspace (VS Code)',
          browserState: [],
          codeState: [],
          chats: { messages: [], rollingSummary: {}, lastSummarizedIndex: 0 },
          lastUpdated: now,
        });
      }
      targetWorkspaceId = workspace.workspaceId;
    }

    // ── Chrome: browser state + chat messages ────────────────────────────────
    if (source === 'chrome' && Array.isArray(chrome?.tabs)) {
      const allChatMessages: any[] = [];
      const browserEntries: any[] = [];

      for (const t of chrome.tabs) {
        if (!isUseful(t.url)) continue;

        // Collect structured messages from AI tabs
        if (Array.isArray(t.messages) && t.messages.length > 0) {
          for (const msg of t.messages) {
            if (msg.role && msg.content) {
              allChatMessages.push({
                role: msg.role,
                content: truncate(String(msg.content), CHAT_MSG_MAX),
                timestamp: now,
              });
            }
          }
        }

        // Build browser tab entry — for AI tabs synthesize content from messages
        let tabContent = String(t.content || '');
        if (isAI(t.url) && Array.isArray(t.messages) && t.messages.length > 0) {
          tabContent = t.messages
            .map((m: any) => `[${String(m.role || '').toUpperCase()}]: ${m.content || ''}`)
            .join('\n\n');
        } else if (t.url.includes('youtube.com') || t.url.includes('youtu.be')) {
          try {
            const transcript = await YoutubeTranscript.fetchTranscript(t.url);
            if (transcript && transcript.length > 0) {
              const text = transcript.map(i => i.text).join(' ');
              tabContent += `\n\n--- Transcript ---\n${text}`;
            }
          } catch (err: any) {
            console.warn(`[ContextMind] Transcript fetch failed for ${t.url}:`, err.message);
          }
        }

        if (tabContent.trim()) {
          browserEntries.push({
            url: t.url,
            title: t.title || 'Untitled',
            content: truncate(tabContent, CONTENT_MAX),
            lastSeen: now,
          });
        }
      }

      if (browserEntries.length > 0) {
        workspace.browserState = upsertBrowserState(workspace.browserState as any[], browserEntries);
        workspace.markModified('browserState');
      }

      if (allChatMessages.length > 0) {
        workspace.chats = appendMessages(workspace.chats, allChatMessages);
        workspace.markModified('chats');
      }
    }

    // ── VS Code: code state ──────────────────────────────────────────────────
    if (source === 'vscode' && vscode) {
      const incoming: any[] = [];
      if (vscode.activeFile?.path) {
        incoming.push({
          path: vscode.activeFile.path,
          content: truncate(vscode.activeFile.content, CONTENT_MAX),
          language: vscode.activeFile.language ?? 'unknown',
          lastSeen: now,
        });
      }
      for (const f of vscode.openFiles ?? []) {
        if (f.path && f.path !== vscode.activeFile?.path) {
          incoming.push({
            path: f.path,
            content: truncate(f.content, CONTENT_MAX),
            language: f.language ?? 'unknown',
            lastSeen: now,
          });
        }
      }
      if (incoming.length > 0) {
        workspace.codeState = upsertCodeState(workspace.codeState as any[], incoming);
        workspace.markModified('codeState');
      }
    }

    workspace.lastUpdated = now;
    await workspace.save();

    return NextResponse.json({ success: true, workspaceId: targetWorkspaceId }, { headers: hdrs });
  } catch (err: any) {
    console.error('❌ /api/save error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500, headers: hdrs });
  }
}
