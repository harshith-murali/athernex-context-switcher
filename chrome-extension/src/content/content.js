const AI_DOMAINS = [
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai",
  "cursor.sh",
  "chatgpt.com"
];

function isAITab(url) {
  return AI_DOMAINS.some(domain => url.includes(domain));
}

function getBasicContent() {
  const url = window.location.href;
  let content = "";

  try {
    if (url.includes("claude.ai")) {
      const conversationEl = document.querySelector("[data-testid='conversation']") ||
                             document.querySelector(".react-scroll-to-bottom") ||
                             document.querySelector("[class*='conversation']");
      if (conversationEl) {
        content = conversationEl.innerText;
      }
    } else if (url.includes("chat.openai.com") || url.includes("chatgpt.com")) {
      const messagesEl = document.querySelector("[role='region']") ||
                         document.querySelector("[class*='chat']") ||
                         document.querySelector("main");
      if (messagesEl) {
        content = messagesEl.innerText;
      }
    } else if (url.includes("gemini.google.com")) {
      const main = document.querySelector("[class*='main']") ||
                   document.querySelector("[role='main']") ||
                   document.querySelector(".conversation");
      if (main) {
        content = main.innerText;
      }
    } else {
      const main = document.querySelector('main, [role="main"], article, .content, #content');
      if (main) {
        content = main.innerText;
      } else {
        content = document.body.innerText;
      }
    }
  } catch (e) {
    console.error("Error getting basic content:", e);
  }

  return content || "";
}

function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, 5000);
}

function generateSessionId() {
  const key = `sessionId_${window.location.hostname}`;
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}

function extractChatGPTMessages() {
  const messages = [];

  // Try multiple selectors for ChatGPT messages
  let messageEls = document.querySelectorAll('[data-message-author-role]');

  if (messageEls.length === 0) {
    messageEls = document.querySelectorAll('[role="article"]');
  }

  for (const el of messageEls) {
    let role = "assistant";
    let content = el.innerText?.trim();

    if (el.getAttribute && el.getAttribute("data-message-author-role")) {
      role = el.getAttribute("data-message-author-role") === "user" ? "user" : "assistant";
    } else if (content) {
      role = /^(hi|hello|hey|what|how|why|can|will|do|show|tell|explain|help|please|thanks)/i.test(content) ? "user" : "assistant";
    }

    if (content && content.length > 5) {
      messages.push({ role, content: cleanText(content) });
    }
  }

  return messages;
}

function extractClaudeMessages() {
  const messages = [];

  const turns = document.querySelectorAll('[data-testid="human-turn"], [data-testid="assistant-turn"]');

  for (const turn of turns) {
    const role = turn.getAttribute("data-testid")?.includes("human") ? "user" : "assistant";
    const content = turn.innerText?.trim();

    if (content) {
      messages.push({ role, content: cleanText(content) });
    }
  }

  return messages;
}

function extractGeminiMessages() {
  const messages = [];

  const userEls = document.querySelectorAll(".user-query-container, [data-role='user']");
  const assistantEls = document.querySelectorAll(".model-response-text, [data-role='model']");

  for (const el of userEls) {
    const content = el.innerText?.trim();
    if (content) {
      messages.push({ role: "user", content: cleanText(content) });
    }
  }

  for (const el of assistantEls) {
    const content = el.innerText?.trim();
    if (content) {
      messages.push({ role: "assistant", content: cleanText(content) });
    }
  }

  return messages;
}

function extractStructuredMessages() {
  const url = window.location.href;
  const messages = [];

  try {
    if (url.includes("claude.ai")) {
      messages.push(...extractClaudeMessages());
    } else if (url.includes("chat.openai.com") || url.includes("chatgpt.com")) {
      messages.push(...extractChatGPTMessages());
    } else if (url.includes("gemini.google.com")) {
      messages.push(...extractGeminiMessages());
    }
  } catch (error) {
    console.error("Error extracting messages:", error);
  }

  return messages;
}

function buildStructuredData() {
  const url = window.location.href;
  const isAI = isAITab(url);

  const tabData = {
    url,
    title: document.title,
    isAITab: isAI
  };

  if (isAI) {
    const messages = extractStructuredMessages();
    if (messages.length > 0) {
      tabData.messages = messages;
    } else {
      const content = getBasicContent().slice(0, 1000);
      if (content && content.length > 20) {
        tabData.content = content;
      }
    }
  } else {
    const content = getBasicContent().slice(0, 500);
    if (content && content.length > 20) {
      tabData.content = content;
    }
  }

  return tabData;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContent") {
    const content = getBasicContent();
    sendResponse({ content: content || "" });
  } else if (request.action === "getStructuredData") {
    const structuredData = buildStructuredData();
    sendResponse({ structuredData });
  } else if (request.action === "getAllTabData") {
    const structuredData = buildStructuredData();
    const content = getBasicContent();
    sendResponse({
      structuredData,
      content,
      sessionId: generateSessionId()
    });
  }
});
