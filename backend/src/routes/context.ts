import { Router } from "express";
import { Workspace } from "../db.js";
import { truncate } from "../utils/filter.js";
import { formatContextToPrompt } from "../utils/contextFormatter.js";

const router = Router();
const SNIPPET = 500;

function cleanText(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? cleaned.slice(0, max) + '...' : cleaned;
}

function extractFunctionsFromCode(code: string | null | undefined): string[] {
  if (!code) return [];
  const fnRegex = /(?:function|const|let|var|class|def)\s+([a-zA-Z0-9_]+)\s*[=\(]/g;
  const funcs = new Set<string>();
  let match;
  while ((match = fnRegex.exec(code)) !== null) {
    if (match[1] && !['if', 'for', 'while', 'switch', 'catch', 'return'].includes(match[1])) {
      funcs.add(match[1]);
    }
  }
  return Array.from(funcs).slice(0, 8);
}

function selectTopFiles(codeState: any[]): any[] {
  if (!Array.isArray(codeState)) return [];
  return [...codeState]
    .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
    .slice(0, 2);
}

function filterTabs(browserState: any[]): any[] {
  if (!Array.isArray(browserState)) return [];
  const BAD_DOMAINS = ['localhost', 'chrome://', 'youtube.com', 'youtu.be'];
  return browserState.filter(t => {
    if (!t.url || !t.content) return false;
    if (BAD_DOMAINS.some(d => t.url.includes(d))) return false;
    return true;
  }).slice(0, 3);
}

function buildContext(workspace: any) {
  const chats = workspace.chats ?? {};
  const summary = chats.summary ?? chats.rollingSummary ?? {};
  const codeState = workspace.codeState ?? [];
  const browserState = workspace.browserState ?? [];

  const task = summary.goal || "Continue current development task";

  const decisions = Array.isArray(summary.decisions) ? summary.decisions : [];
  const hardConstraints = decisions
    .map(d => cleanText(d, 100))
    .filter(Boolean)
    .slice(0, 6);

  const softContext = {
    goal: cleanText(summary.goal, 150),
    progress: cleanText(summary.progress, 150),
    nextSteps: Array.isArray(summary.nextSteps) 
      ? summary.nextSteps.map(s => cleanText(s, 100)).slice(0, 4)
      : []
  };

  const codeContext = selectTopFiles(codeState).map(f => {
    const funcs = extractFunctionsFromCode(f.content);
    return `File: ${f.path} | Functions: ${funcs.join(', ')} | Purpose: ${cleanText(f.content, 80)}`;
  });

  const knowledgeContext = filterTabs(browserState).map(t => {
    const isAI = ['chatgpt.com', 'claude.ai', 'chat.openai.com'].some(d => t.url.includes(d));
    const contentLimit = isAI ? 1500 : 300; // Give massive priority to AI transcripts
    return `[${t.title}]: ${cleanText(t.content, contentLimit)}`;
  });

  return {
    task,
    hardConstraints,
    softContext,
    codeContext,
    knowledgeContext
  };
}

// ── GET /context/:workspaceId/prompt — full priming prompt ───────────────────

router.get("/context/:workspaceId/prompt", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findOne({ workspaceId });
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });

    const contextObj = buildContext(workspace);
    const prompt = await formatContextToPrompt(contextObj);
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

export default router;
