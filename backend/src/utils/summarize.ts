import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ChatMessage {
  role: string;
  content: string;
  timestamp?: number;
}

export interface ChatSummary {
  goal: string;
  decisions: string[];
  constraints: string[];
  progress: string;
  nextSteps: string[];
}

export interface ChatState {
  messages: ChatMessage[];
  summary: ChatSummary;
  lastSummarizedIndex: number;
}

const SUMMARIZE_THRESHOLD = 8;
const MAX_MESSAGES_RETAINED = 6;

function emptySummary(): ChatSummary {
  return {
    goal: "",
    decisions: [],
    constraints: [],
    progress: "",
    nextSteps: []
  };
}

/**
 * Parses JSON safely from a string that might contain markdown blocks
 */
function safeParseJSON(text: string, fallback: any): any {
  try {
    const cleaned = text.replace(/```(?:json)?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Ensure all required fields exist
    return {
      goal: parsed.goal || fallback.goal || "",
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : fallback.decisions || [],
      constraints: Array.isArray(parsed.constraints) ? parsed.constraints : fallback.constraints || [],
      progress: parsed.progress || fallback.progress || "",
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : fallback.nextSteps || [],
    };
  } catch (err) {
    console.error("❌ [Gemini] Failed to parse summary JSON:", err);
    return fallback;
  }
}

/**
 * Compresses the conversation incrementally using Gemini
 */
export async function summarizeChat(chat: ChatState): Promise<ChatState> {
  const safeChat: ChatState = chat ?? {
    messages: [],
    summary: emptySummary(),
    lastSummarizedIndex: 0
  };

  const newMessages = safeChat.messages.slice(safeChat.lastSummarizedIndex || 0);

  if (newMessages.length < SUMMARIZE_THRESHOLD) {
    return safeChat;
  }

  console.log(`🤖 [Gemini] Summarizing ${newMessages.length} new messages...`);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const previousSummaryJSON = JSON.stringify(safeChat.summary || emptySummary(), null, 2);
    const messagesText = newMessages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n\n");

    const prompt = `You are compressing a technical conversation.

Previous summary:
${previousSummaryJSON}

New messages:
${messagesText}

Update the summary by:
1. Keeping the main goal
2. Updating progress
3. Adding important decisions
4. Keeping constraints
5. Removing redundant information

Return ONLY valid JSON in this format:
{
  "goal": "",
  "decisions": [],
  "constraints": [],
  "progress": "",
  "nextSteps": []
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const newSummary = safeParseJSON(text, safeChat.summary || emptySummary());

    safeChat.summary = newSummary;
    safeChat.lastSummarizedIndex = safeChat.messages.length;

    // Optional optimization: Keep only last N messages
    if (safeChat.messages.length > MAX_MESSAGES_RETAINED) {
      safeChat.messages = safeChat.messages.slice(-MAX_MESSAGES_RETAINED);
      safeChat.lastSummarizedIndex = safeChat.messages.length;
    }

    return safeChat;
  } catch (error) {
    console.error("❌ [Gemini] Summarization error:", error);
    return safeChat; // fallback to old state
  }
}
