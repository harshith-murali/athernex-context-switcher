import { Router } from "express";
import { Workspace } from "../db.js";
import { upsertBrowserState, upsertCodeState } from "../utils/dedup.js";
import { isUsefulUrl, hasContent, truncate } from "../utils/filter.js";
import { summarizeChat, ChatMessage } from "../utils/summarize.js";
import { deduplicateMessages } from "../utils/extract.js";

const router = Router();

const CONTENT_MAX  = 50_000;   // per browser tab / Google Doc
const CHAT_MSG_MAX = 100_000;  // per ChatGPT/Claude/Gemini message turn — keep full

// ── POST /save  (full save from Chrome popup / VS Code) ──────────────────────

router.post("/save", async (req, res) => {
  try {
    const { workspaceId, source, timestamp, chrome, vscode } = req.body;
    const now = timestamp ?? Date.now();

    if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });

    const workspace = await Workspace.findOne({ workspaceId });
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });

    // ── Browser state ─────────────────────────────────────────
    if (source === "chrome" && Array.isArray(chrome?.tabs)) {
      const incoming = chrome.tabs
        .filter((t: any) => isUsefulUrl(t.url) && hasContent(t.content))
        .map((t: any) => ({
          url:      t.url as string,
          title:    (t.title as string) || "Untitled",
          content:  truncate(t.content as string, CONTENT_MAX),
          lastSeen: now,
        }));

      if (incoming.length > 0) {
        workspace.browserState = upsertBrowserState(workspace.browserState as any, incoming) as any;
        workspace.markModified("browserState");
      }

      // Chat messages from AI tabs
      const chatMessages: ChatMessage[] = [];
      for (const tab of chrome.tabs) {
        if (Array.isArray(tab.messages)) {
          for (const msg of tab.messages) {
            if (msg.role && msg.content) {
              chatMessages.push({
                role:      msg.role,
                content:   truncate(msg.content, CHAT_MSG_MAX),
                timestamp: now,
              });
            }
          }
        }
      }

      if (chatMessages.length > 0) {
        const existing = (workspace.chats as any)?.messages ?? [];
        const fresh = deduplicateMessages(existing, chatMessages);
        if (fresh.length > 0) {
          if (!workspace.chats || !workspace.chats.messages) {
            workspace.chats = { messages: [], summary: { goal: "", decisions: [], constraints: [], progress: "", nextSteps: [] }, lastSummarizedIndex: 0 };
          }
          workspace.chats.messages.push(...fresh);
          workspace.chats = await summarizeChat(workspace.chats as any) as any;
          workspace.markModified("chats");
        }
      }
    }

    // ── Code state ────────────────────────────────────────────
    if (source === "vscode" && vscode) {
      const incoming: any[] = [];

      if (vscode.activeFile?.path) {
        incoming.push({
          path:     vscode.activeFile.path as string,
          content:  truncate(vscode.activeFile.content ?? "", CONTENT_MAX),
          language: vscode.activeFile.language ?? "unknown",
          lastSeen: now,
        });
      }

      for (const f of vscode.openFiles ?? []) {
        if (f.path && f.path !== vscode.activeFile?.path) {
          incoming.push({
            path:     f.path as string,
            content:  truncate(f.content ?? "", CONTENT_MAX),
            language: f.language ?? "unknown",
            lastSeen: now,
          });
        }
      }

      if (incoming.length > 0) {
        workspace.codeState = upsertCodeState(workspace.codeState as any, incoming) as any;
        workspace.markModified("codeState");
      }
    }

    workspace.lastUpdated = now;
    await workspace.save();

    console.log(`✅ /save [${source}] → workspace ${workspaceId}`);
    res.json({ success: true, workspaceId });
  } catch (err: any) {
    console.error("❌ /save error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ── POST /auto-save  (content script fires on every AI response) ─────────────
// Receives only the latest exchange (1-2 messages), deduplicates, and appends.

router.post("/auto-save", async (req, res) => {
  try {
    const { workspaceId, messages, url, title } = req.body;
    const now = Date.now();

    if (!workspaceId || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing workspaceId or messages" });
    }

    const workspace = await Workspace.findOne({ workspaceId });
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });

    // Deduplicate against existing history before appending
    const existing = (workspace.chats as any)?.messages ?? [];
    const fresh: ChatMessage[] = deduplicateMessages(
      existing,
      messages
        .filter((m: any) => m.role && m.content)
        .map((m: any) => ({
          role:      m.role,
          content:   truncate(m.content, CHAT_MSG_MAX),
          timestamp: now,
        }))
    );

    if (fresh.length > 0) {
      if (!workspace.chats || !workspace.chats.messages) {
        workspace.chats = { messages: [], summary: { goal: "", decisions: [], constraints: [], progress: "", nextSteps: [] }, lastSummarizedIndex: 0 };
      }
      workspace.chats.messages.push(...fresh);
      workspace.chats = await summarizeChat(workspace.chats as any) as any;
      workspace.markModified("chats");

      // Also upsert the AI tab in browserState so the tab card shows up
      if (url && isUsefulUrl(url)) {
        const tabEntry = [{
          url,
          title:    title || "AI Conversation",
          content:  fresh.map((m: ChatMessage) => `[${m.role}]: ${m.content}`).join('\n\n').slice(0, CONTENT_MAX),
          lastSeen: now,
        }];
        workspace.browserState = upsertBrowserState(workspace.browserState as any, tabEntry) as any;
        workspace.markModified("browserState");
      }

      workspace.lastUpdated = now;
      await workspace.save();
      console.log(`⚡ /auto-save → ${fresh.length} new msg(s) → workspace ${workspaceId}`);
    }

    res.json({ success: true, added: fresh.length });
  } catch (err: any) {
    console.error("❌ /auto-save error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

export default router;
