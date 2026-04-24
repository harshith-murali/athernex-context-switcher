import { Router } from "express";
import { Workspace } from "../db.js";
import { truncate } from "../utils/filter.js";

const router = Router();
const SNIPPET = 500;

// ── GET /context/:workspaceId/prompt — full priming prompt ───────────────────

router.get("/context/:workspaceId/prompt", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findOne({ workspaceId });
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });

    const prompt = buildPrimingPrompt(workspace);
    const tokenEstimate = Math.ceil(prompt.length / 4);

    res.json({ prompt, tokenEstimate, workspaceId, name: workspace.name });
  } catch (err: any) {
    console.error("❌ /prompt error:", err);
    res.status(500).json({ error: "Failed to generate prompt", details: err.message });
  }
});

// ── GET /context/:workspaceId — structured context (dashboard / UI) ───────────

router.get("/context/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findOne({ workspaceId });
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });

    const topBrowser = [...workspace.browserState]
      .sort((a: any, b: any) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
      .slice(0, 3)
      .map((t: any) => ({ title: t.title, url: t.url, snippet: truncate(t.content, SNIPPET) }));

    const sortedCode = [...workspace.codeState]
      .sort((a: any, b: any) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

    const activeFile = sortedCode[0]
      ? { path: sortedCode[0].path, language: sortedCode[0].language, snippet: truncate((sortedCode[0] as any).content, SNIPPET) }
      : null;

    const relatedFiles = sortedCode.slice(1, 3).map((f: any) => ({
      path: f.path, language: f.language, snippet: truncate(f.content, SNIPPET),
    }));

    const chats = workspace.chats as any;

    res.json({
      code:        { activeFile, relatedFiles },
      browser:     topBrowser,
      chatSummary: chats?.summary ?? null,
      recentMessages: (chats?.messages ?? []).slice(-8),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch context", details: err.message });
  }
});

// ── GET /context — list workspaces ────────────────────────────────────────────

router.get("/context", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const workspaces = await Workspace
      .find({ userId }, { workspaceId: 1, name: 1, lastUpdated: 1 })
      .sort({ lastUpdated: -1 });

    res.json({
      workspaces: workspaces.map(w => ({
        workspaceId: w.workspaceId,
        name:        w.name,
        lastUpdated: w.lastUpdated,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list workspaces", details: err.message });
  }
});

// ── Priming prompt builder ────────────────────────────────────────────────────

function buildPrimingPrompt(workspace: any): string {
  const chats    = workspace.chats ?? {};
  const summary  = chats.summary ?? {};
  const messages: any[] = chats.messages ?? [];
  const code:     any[] = [...(workspace.codeState ?? [])].sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  const browser:  any[] = [...(workspace.browserState ?? [])].sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  const divider  = '─'.repeat(60);
  const header   = '═'.repeat(60);
  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────
  lines.push(header);
  lines.push(`  CONTEXTMIND — Project Handoff: ${workspace.name}`);
  lines.push(header);
  lines.push('');
  lines.push('You are resuming an active development session. All context');
  lines.push('below is current. Read it fully before responding. Do not');
  lines.push('ask for information already present here.');
  lines.push('');

  // ── Tech stack (from extracted key terms) ─────────────────
  const techStack: string[] = summary.techStack ?? [];
  if (techStack.length > 0) {
    lines.push(divider);
    lines.push('  TECH STACK');
    lines.push(divider);
    lines.push(techStack.join(' · '));
    lines.push('');
  }

  // ── Active code file (full content) ───────────────────────
  if (code.length > 0) {
    const active = code[0];
    lines.push(divider);
    lines.push(`  ACTIVE FILE: ${active.path}`);
    lines.push(divider);
    lines.push('```' + (active.language ?? ''));
    lines.push(active.content ?? '');
    lines.push('```');
    lines.push('');

    // Other open files — full content for small files, snippet for large
    const others = code.slice(1, 4);
    if (others.length > 0) {
      lines.push(divider);
      lines.push('  OTHER OPEN FILES');
      lines.push(divider);
      for (const f of others) {
        lines.push(`▸ ${f.path} (${f.language ?? 'unknown'})`);
        if (f.content?.length < 3000) {
          lines.push('```' + (f.language ?? ''));
          lines.push(f.content ?? '');
          lines.push('```');
        } else {
          lines.push('```' + (f.language ?? ''));
          lines.push(truncate(f.content ?? '', 1500));
          lines.push('  … (truncated)');
          lines.push('```');
        }
      }
      lines.push('');
    }
  }

  // ── Conversation summary ───────────────────────────────────
  if (summary.goal) {
    lines.push(divider);
    lines.push('  CONVERSATION SUMMARY');
    lines.push(divider);

    lines.push(`Goal: ${summary.goal}`);

    if (summary.progress) {
      lines.push(`Progress: ${summary.progress}`);
    }

    if (summary.decisions?.length > 0) {
      lines.push('');
      lines.push('Key decisions made:');
      summary.decisions.slice(-8).forEach((d: string) => lines.push(`  • ${d}`));
    }

    if (summary.errorHistory?.length > 0) {
      lines.push('');
      lines.push('Errors encountered:');
      summary.errorHistory.forEach((e: string) => lines.push(`  ✗ ${e}`));
    }

    if (summary.codeSnippets?.length > 0) {
      lines.push('');
      lines.push('Key code from conversation:');
      summary.codeSnippets.slice(-3).forEach((s: string) => {
        lines.push('```');
        lines.push(s.slice(0, 800));
        lines.push('```');
      });
    }

    lines.push('');
  }

  // ── Recent messages (verbatim) ─────────────────────────────
  const recent = messages.slice(-10);
  if (recent.length > 0) {
    lines.push(divider);
    lines.push('  RECENT CONVERSATION');
    lines.push(divider);

    for (const msg of recent) {
      const label = msg.role === 'user' ? '[YOU]' : '[ASSISTANT]';
      const content = msg.content.length > 3000
        ? msg.content.slice(0, 3000) + '\n  … (truncated)'
        : msg.content;
      lines.push('');
      lines.push(label);
      lines.push(content);
    }
    lines.push('');
  }

  // ── Reference browser tabs (non-AI, research material) ────
  const refTabs = browser.filter((t: any) =>
    !['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai'].some(d => t.url?.includes(d))
  ).slice(0, 3);

  if (refTabs.length > 0) {
    lines.push(divider);
    lines.push('  REFERENCE MATERIAL (Browser Tabs)');
    lines.push(divider);
    for (const tab of refTabs) {
      lines.push(`▸ ${tab.title}`);
      lines.push(`  ${tab.url}`);
      if (tab.content?.length > 20) {
        lines.push(`  "${tab.content.slice(0, 300).replace(/\n/g, ' ')}…"`);
      }
    }
    lines.push('');
  }

  // ── Resume instruction ─────────────────────────────────────
  const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');

  lines.push(header);
  lines.push('  CONTINUE FROM HERE');
  lines.push(header);
  if (lastUser) {
    lines.push(`Last task: "${lastUser.content.slice(0, 200).replace(/\n/g, ' ')}"`);
    lines.push('');
  }
  lines.push('Pick up exactly where we left off. Be direct and specific.');
  lines.push('Do not repeat explanations already given in the conversation above.');
  lines.push('If writing code, output the complete updated file, not just a snippet.');

  return lines.join('\n');
}

export default router;
