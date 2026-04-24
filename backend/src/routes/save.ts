import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { Session } from "../db.js";
import { getStructuredContent } from "../mcp/router.js";

const router = Router();

const AI_DOMAINS = [
  "claude.ai",
  "chat.openai.com",
  "gemini.google.com",
  "cursor.sh",
  "perplexity.ai"
];

function isAITab(url: string): boolean {
  return AI_DOMAINS.some(domain => url.includes(domain));
}

interface ChromeTab {
  url: string;
  title: string;
  content: string;
  favicon?: string;
}

async function processTab(tab: ChromeTab) {
  if (isAITab(tab.url)) {
    // For AI tabs, compress conversation content
    const lines = tab.content.split("\n").filter(l => l.trim());
    const compressed = lines.slice(0, 500).join(" ");
    return {
      url: tab.url,
      title: tab.title,
      content: compressed,
      sourceType: "ai"
    };
  }

  // Try MCP extraction
  const structured = await getStructuredContent(tab.url);
  if (structured) {
    return {
      url: tab.url,
      title: structured.title,
      content: structured.content,
      sourceType: "mcp"
    };
  }

  // Fallback to raw content
  return {
    url: tab.url,
    title: tab.title,
    content: tab.content.slice(0, 5000),
    sourceType: "raw"
  };
}

function generateSummary(tabs: any[]): string {
  const aiTabs = tabs.filter(t => t.sourceType === "ai");
  const workTabs = tabs.length - aiTabs.length;

  return `You were working on ${aiTabs.length} AI conversations and ${workTabs} other tasks.`;
}

function generatePrimingPrompt(tabs: any[]): string {
  const tabList = tabs.map(t => `- ${t.title}: ${t.url}`).join("\n");

  return `I was working on the following context. Please review and help me continue:

TABS REVIEWED:
${tabList}

CONVERSATION HISTORY:
${tabs.find(t => t.sourceType === "ai")?.content || "No AI conversation found"}

NEXT STEPS:
Please help me continue from where I left off.`;
}

router.post("/save", async (req, res) => {
  try {
    const { chrome } = req.body;
    const userId = (req as any).userId; // From Clerk middleware

    if (!chrome?.tabs || chrome.tabs.length === 0) {
      return res.status(400).json({ error: "No tabs provided" });
    }

    // Process all tabs
    const processedTabs = await Promise.all(
      chrome.tabs.map(processTab)
    );

    const sessionId = uuidv4();
    const userSummary = generateSummary(processedTabs);
    const primingPrompt = generatePrimingPrompt(processedTabs);

    // Save to MongoDB
    const session = new Session({
      sessionId,
      userId,
      timestamp: Date.now(),
      chromePayload: {
        windowId: chrome.windowId,
        tabsCount: chrome.tabs.length
      },
      userSummary,
      primingPrompt,
      tabs: processedTabs
    });

    await session.save();

    res.json({
      sessionId,
      status: "success",
      userSummary,
      primingPrompt
    });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: "Failed to save context" });
  }
});

export default router;
