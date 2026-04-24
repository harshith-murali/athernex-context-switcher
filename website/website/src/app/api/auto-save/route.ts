import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { connectDB, Workspace } from '@/lib/db';

const CHAT_MSG_MAX = 100_000;
const CONTENT_MAX  = 50_000;
const MAX_MESSAGES = 60;

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: hdrs });
    }

    await connectDB();
    const { workspaceId, messages, url, title } = await req.json();

    if (!workspaceId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing workspaceId or messages' }, { status: 400, headers: hdrs });
    }

    const workspace: any = await Workspace.findOne({ workspaceId, userId });
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404, headers: hdrs });
    }

    const now = Date.now();
    const existing = workspace.chats?.messages ?? [];

    const incoming = messages
      .filter((m: any) => m.role && m.content)
      .map((m: any) => ({
        role: m.role,
        content: truncate(String(m.content), CHAT_MSG_MAX),
        timestamp: now,
      }));

    const fresh = dedup(existing, incoming);

    if (fresh.length > 0) {
      const all = [...existing, ...fresh].slice(-MAX_MESSAGES);
      workspace.chats = {
        messages: all,
        rollingSummary: buildSummary(all, workspace.chats?.rollingSummary ?? {}),
        lastSummarizedIndex: all.length,
      };
      workspace.markModified('chats');

      // Upsert the AI tab in browserState
      if (url && url.startsWith('http') && !url.includes('localhost')) {
        const tabContent = fresh.map((m: any) => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');
        const existing_browser: any[] = workspace.browserState ?? [];
        const map = new Map(existing_browser.map((e: any) => [e.url, e]));
        map.set(url, { url, title: title || 'AI Conversation', content: truncate(tabContent, CONTENT_MAX), lastSeen: now });
        workspace.browserState = Array.from(map.values());
        workspace.markModified('browserState');
      }

      workspace.lastUpdated = now;
      await workspace.save();
    }

    return NextResponse.json({ success: true, added: fresh.length }, { headers: hdrs });
  } catch (err: any) {
    console.error('❌ /api/auto-save error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500, headers: hdrs });
  }
}
