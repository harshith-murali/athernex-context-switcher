import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { connectDB, Workspace } from '@/lib/db';

function trunc(s: string | undefined | null, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

// Mirror of backend/src/routes/context.ts buildPrimingPrompt
function buildPrimingPrompt(workspace: any): string {
  const chats   = workspace.chats   ?? {};
  const summary = chats.rollingSummary ?? {};
  const messages: any[] = chats.messages ?? [];
  const code:  any[] = [...(workspace.codeState   ?? [])].sort((a: any, b: any) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  const browser: any[] = [...(workspace.browserState ?? [])].sort((a: any, b: any) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  const H = '═'.repeat(60);
  const D = '─'.repeat(60);
  const lines: string[] = [];

  // Header
  lines.push(H);
  lines.push(`  CONTEXTMIND — Project Handoff: ${workspace.name}`);
  lines.push(H);
  lines.push('');
  lines.push('You are resuming an active development session. All context');
  lines.push('below is current. Read it fully before responding. Do not');
  lines.push('ask for information already present here.');
  lines.push('');

  // Tech stack
  const techStack: string[] = summary.techStack ?? [];
  if (techStack.length > 0) {
    lines.push(D);
    lines.push('  TECH STACK');
    lines.push(D);
    lines.push(techStack.join(' · '));
    lines.push('');
  }

  // Active code file
  if (code.length > 0) {
    const active = code[0];
    lines.push(D);
    lines.push(`  ACTIVE FILE: ${active.path}`);
    lines.push(D);
    lines.push('```' + (active.language ?? ''));
    lines.push(active.content ?? '');
    lines.push('```');
    lines.push('');

    const others = code.slice(1, 4);
    if (others.length > 0) {
      lines.push(D);
      lines.push('  OTHER OPEN FILES');
      lines.push(D);
      for (const f of others) {
        lines.push(`▸ ${f.path} (${f.language ?? 'unknown'})`);
        if ((f.content?.length ?? 0) < 3000) {
          lines.push('```' + (f.language ?? ''));
          lines.push(f.content ?? '');
          lines.push('```');
        } else {
          lines.push('```' + (f.language ?? ''));
          lines.push(trunc(f.content, 1500));
          lines.push('  … (truncated)');
          lines.push('```');
        }
      }
      lines.push('');
    }
  }

  // Conversation summary
  if (summary.goal) {
    lines.push(D);
    lines.push('  CONVERSATION SUMMARY');
    lines.push(D);
    lines.push(`Goal: ${summary.goal}`);
    if (summary.progress) lines.push(`Progress: ${summary.progress}`);

    if (summary.decisions?.length > 0) {
      lines.push('');
      lines.push('Key decisions made:');
      (summary.decisions as string[]).slice(-8).forEach(d => lines.push(`  • ${d}`));
    }
    if (summary.errorHistory?.length > 0) {
      lines.push('');
      lines.push('Errors encountered:');
      (summary.errorHistory as string[]).forEach(e => lines.push(`  ✗ ${e}`));
    }
    if (summary.codeSnippets?.length > 0) {
      lines.push('');
      lines.push('Key code from conversation:');
      (summary.codeSnippets as string[]).slice(-3).forEach(s => {
        lines.push('```');
        lines.push(s.slice(0, 800));
        lines.push('```');
      });
    }
    lines.push('');
  }

  // Recent messages verbatim
  const recent = messages.slice(-10);
  if (recent.length > 0) {
    lines.push(D);
    lines.push('  RECENT CONVERSATION');
    lines.push(D);
    for (const msg of recent) {
      const label   = msg.role === 'user' ? '[YOU]' : '[ASSISTANT]';
      const content = (msg.content as string).length > 3000
        ? msg.content.slice(0, 3000) + '\n  … (truncated)'
        : msg.content;
      lines.push('');
      lines.push(label);
      lines.push(content);
    }
    lines.push('');
  }

  // Reference browser tabs (exclude AI tabs)
  const AI_DOMAINS = ['chat.openai.com','chatgpt.com','claude.ai','gemini.google.com','perplexity.ai'];
  const refTabs = browser
    .filter((t: any) => !AI_DOMAINS.some(d => t.url?.includes(d)))
    .slice(0, 3);

  if (refTabs.length > 0) {
    lines.push(D);
    lines.push('  REFERENCE MATERIAL (Browser Tabs)');
    lines.push(D);
    for (const tab of refTabs) {
      lines.push(`▸ ${tab.title}`);
      lines.push(`  ${tab.url}`);
      if (tab.content?.length > 20) {
        lines.push(`  "${(tab.content as string).slice(0, 300).replace(/\n/g, ' ')}…"`);
      }
    }
    lines.push('');
  }

  // Resume instruction
  const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
  lines.push(H);
  lines.push('  CONTINUE FROM HERE');
  lines.push(H);
  if (lastUser) {
    lines.push(`Last task: "${(lastUser.content as string).slice(0, 200).replace(/\n/g, ' ')}"`);
    lines.push('');
  }
  lines.push('Pick up exactly where we left off. Be direct and specific.');
  lines.push('Do not repeat explanations already given in the conversation above.');
  lines.push('If writing code, output the complete updated file, not just a snippet.');

  return lines.join('\n');
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { workspaceId } = await params;
    const workspace = await Workspace.findOne({ workspaceId, userId }).lean() as any;
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const prompt = buildPrimingPrompt(workspace);
    return NextResponse.json({
      prompt,
      tokenEstimate: Math.ceil(prompt.length / 4),
      workspaceId,
      name: workspace.name,
    });
  } catch (err: any) {
    console.error('❌ /api/context/[workspaceId]/prompt:', err);
    return NextResponse.json({ error: 'Failed to generate prompt', details: err.message }, { status: 500 });
  }
}
