// ContextMind content script
// Auto-saves every AI response + full manual scrape on demand

const AI_DOMAINS = [
  'chat.openai.com', 'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'perplexity.ai',
  'cursor.sh',
];

const BACKEND      = 'http://localhost:37218';
const WEBSITE_URL  = 'http://localhost:3000';

function isAITab(url) {
  return AI_DOMAINS.some(d => url.includes(d));
}

function getText(el) {
  return el ? (el.innerText || el.textContent || '').trim() : '';
}

function cleanText(text, maxLen = 100000) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function byDOMOrder(a, b) {
  const pos = a.el.compareDocumentPosition(b.el);
  if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & Node.DOCUMENT_POSITION_PRECEDING)  return 1;
  return 0;
}

// ── ChatGPT ───────────────────────────────────────────────────────────────────

function extractChatGPTMessages() {
  const messages = [];

  // Primary: [data-message-author-role]
  const roleEls = Array.from(document.querySelectorAll('[data-message-author-role]'));
  if (roleEls.length > 0) {
    for (const el of roleEls) {
      const role = el.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';
      const inner = el.querySelector('.markdown, .whitespace-pre-wrap, [class*="prose"], [class*="message-content"]');
      const text = getText(inner || el);
      if (text.length > 3) messages.push({ role, content: cleanText(text) });
    }
    return messages;
  }

  // Fallback A: article conversation turns
  const articles = Array.from(document.querySelectorAll('article[data-testid*="conversation-turn"]'));
  if (articles.length > 0) {
    for (const art of articles) {
      const roleEl = art.querySelector('[data-message-author-role]');
      const role = roleEl?.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';
      const text = getText(art);
      if (text.length > 3) messages.push({ role, content: cleanText(text) });
    }
    return messages;
  }

  // Fallback B: articles in main
  const main = document.querySelector('main');
  if (main) {
    for (const art of Array.from(main.querySelectorAll('article'))) {
      const text = getText(art);
      if (text.length > 3) messages.push({ role: 'assistant', content: cleanText(text) });
    }
  }

  return messages;
}

// ── Claude ────────────────────────────────────────────────────────────────────

function extractClaudeMessages() {
  const messages = [];

  const turns = Array.from(document.querySelectorAll('[data-testid="human-turn"], [data-testid="assistant-turn"]'));
  if (turns.length > 0) {
    for (const turn of turns) {
      const role = turn.getAttribute('data-testid').includes('human') ? 'user' : 'assistant';
      const inner = turn.querySelector('[class*="prose"], [class*="message"], .font-claude-message');
      const text = getText(inner || turn);
      if (text.length > 3) messages.push({ role, content: cleanText(text) });
    }
    return messages;
  }

  // Fallback: class-based sorted by DOM position
  const humanEls = Array.from(document.querySelectorAll('.human-turn, [class*="human-turn"]')).map(el => ({ el, role: 'user' }));
  const asstEls  = Array.from(document.querySelectorAll('.assistant-turn, .font-claude-message')).map(el => ({ el, role: 'assistant' }));
  const all = [...humanEls, ...asstEls].sort(byDOMOrder);
  for (const { el, role } of all) {
    const text = getText(el);
    if (text.length > 3) messages.push({ role, content: cleanText(text) });
  }
  return messages;
}

// ── Gemini ────────────────────────────────────────────────────────────────────

function extractGeminiMessages() {
  const messages = [];

  // Current UI: web-component tags
  const userEls  = Array.from(document.querySelectorAll('user-query')).map(el => ({ el, role: 'user' }));
  const modelEls = Array.from(document.querySelectorAll('model-response')).map(el => ({ el, role: 'assistant' }));

  if (userEls.length > 0 || modelEls.length > 0) {
    const all = [...userEls, ...modelEls].sort(byDOMOrder);
    for (const { el, role } of all) {
      const inner = role === 'user'
        ? el.querySelector('.query-text, .query-content, p')
        : el.querySelector('message-content, .markdown, .response-content, p');
      const text = getText(inner || el);
      if (text.length > 3) messages.push({ role, content: cleanText(text) });
    }
    return messages;
  }

  // Fallback: conversation-turn wrappers
  const turns = Array.from(document.querySelectorAll('conversation-turn'));
  if (turns.length > 0) {
    for (const turn of turns) {
      const isUser = !!turn.querySelector('user-query, .user-query');
      const text = getText(turn);
      if (text.length > 3) messages.push({ role: isUser ? 'user' : 'assistant', content: cleanText(text) });
    }
    return messages;
  }

  // Older selectors
  const uFall = Array.from(document.querySelectorAll('.user-query-container, .user-query')).map(el => ({ el, role: 'user' }));
  const mFall = Array.from(document.querySelectorAll('.model-response-text, .response-container')).map(el => ({ el, role: 'assistant' }));
  const combined = [...uFall, ...mFall].sort(byDOMOrder);
  for (const { el, role } of combined) {
    const text = getText(el);
    if (text.length > 3) messages.push({ role, content: cleanText(text) });
  }

  return messages;
}

// ── Perplexity ────────────────────────────────────────────────────────────────

function extractPerplexityMessages() {
  const messages = [];

  const urlQuery = new URLSearchParams(window.location.search).get('q');
  const headingEl = document.querySelector('h1, [class*="query"], [class*="question"]');
  const queryText = urlQuery || getText(headingEl);
  if (queryText.length > 3) messages.push({ role: 'user', content: cleanText(queryText) });

  for (const el of Array.from(document.querySelectorAll('[class*="prose"], .markdown, [class*="answer"]'))) {
    const text = getText(el);
    if (text.length > 50) { messages.push({ role: 'assistant', content: cleanText(text) }); break; }
  }

  for (const item of Array.from(document.querySelectorAll('[data-testid*="followup"], [class*="followup"]'))) {
    const q = item.querySelector('[class*="question"], [class*="query"]');
    const a = item.querySelector('[class*="prose"], .markdown');
    if (q) messages.push({ role: 'user',      content: cleanText(getText(q)) });
    if (a) messages.push({ role: 'assistant', content: cleanText(getText(a)) });
  }

  return messages;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

function extractStructuredMessages() {
  const url = window.location.href;
  try {
    if (url.includes('claude.ai'))                                     return extractClaudeMessages();
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) return extractChatGPTMessages();
    if (url.includes('gemini.google.com'))                              return extractGeminiMessages();
    if (url.includes('perplexity.ai'))                                  return extractPerplexityMessages();
  } catch (e) {
    console.error('[ContextMind] extractStructuredMessages:', e);
  }
  return [];
}

// ── Latest exchange (for auto-save — avoids full-page re-scrape) ──────────────

function getLatestExchange() {
  const all = extractStructuredMessages();
  if (all.length === 0) return [];

  // Find last assistant message
  let lastAsstIdx = -1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].role === 'assistant') { lastAsstIdx = i; break; }
  }
  if (lastAsstIdx === -1) return [];

  const result = [];
  // Include the user turn immediately before it
  if (lastAsstIdx > 0 && all[lastAsstIdx - 1].role === 'user') {
    result.push(all[lastAsstIdx - 1]);
  }
  result.push(all[lastAsstIdx]);
  return result;
}

// ── Count assistant messages (used to detect new responses) ──────────────────

function countAssistantMessages() {
  const url = window.location.href;
  if (url.includes('chatgpt.com') || url.includes('chat.openai.com'))
    return document.querySelectorAll('[data-message-author-role="assistant"]').length;
  if (url.includes('claude.ai'))
    return document.querySelectorAll('[data-testid="assistant-turn"]').length;
  if (url.includes('gemini.google.com'))
    return document.querySelectorAll('model-response').length;
  if (url.includes('perplexity.ai'))
    return document.querySelectorAll('[class*="prose"], .markdown').length;
  return 0;
}

// ── Auto-save — fires on every completed AI response ─────────────────────────

let autoSaveTimer    = null;
let knownAsstCount   = 0;
let autoWorkspaceId  = null;

async function triggerAutoSave() {
  if (!autoWorkspaceId) return;

  const exchange = getLatestExchange();
  if (exchange.length === 0) return;

  const payload = JSON.stringify({
    workspaceId: autoWorkspaceId,
    messages:    exchange,
    url:         window.location.href,
    title:       document.title,
  });

  // Try local backend first (fast, no auth needed)
  let saved = false;
  try {
    const res = await fetch(`${BACKEND}/auto-save`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    payload,
    });
    if (res.ok) {
      saved = true;
      console.log(`[ContextMind] auto-saved ${exchange.length} message(s) via backend`);
    }
  } catch { /* backend offline */ }

  // Fallback: website API (uses Clerk session cookie — works without local backend)
  if (!saved) {
    try {
      await fetch(`${WEBSITE_URL}/api/auto-save`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        payload,
      });
      console.log(`[ContextMind] auto-saved ${exchange.length} message(s) via website API`);
    } catch { /* silent fail */ }
  }
}

function setupAutoSave() {
  if (!isAITab(window.location.href)) return;

  // Read saved workspaceId — set by popup.js when user selects a workspace
  chrome.storage.local.get(['autoSaveWorkspaceId'], result => {
    autoWorkspaceId = result.autoSaveWorkspaceId ?? null;
    knownAsstCount  = countAssistantMessages();
  });

  // Listen for workspace updates from popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.autoSaveWorkspaceId) {
      autoWorkspaceId = changes.autoSaveWorkspaceId.newValue ?? null;
    }
  });

  // Watch the conversation container for new AI responses
  const target = document.querySelector('main, [role="main"]') || document.body;

  const observer = new MutationObserver(() => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      const current = countAssistantMessages();
      if (current > knownAsstCount) {
        // A new assistant message appeared and DOM has been stable for 2 s
        knownAsstCount = current;
        await triggerAutoSave();
      }
    }, 2000); // 2 s debounce — gives ChatGPT streaming time to finish
  });

  observer.observe(target, { childList: true, subtree: true, characterData: true });
}

// ── Google Docs export — fetches full doc text via the export API ─────────────

async function getGoogleDocsContent() {
  const url = window.location.href;

  // For edit URLs: use the export API (most reliable — bypasses KIX rendering)
  const docMatch = url.match(/\/document\/d\/([^/]+)/);
  if (docMatch) {
    try {
      const res = await fetch(
        `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const text = await res.text();
        return cleanText(text, 100000);
      }
    } catch (e) {
      console.warn('[ContextMind] Docs export API failed, falling back to DOM:', e.message);
    }
  }

  // Fallback: DOM selectors (works for published /pub docs)
  const paragraphs = document.querySelectorAll('.kix-paragraphrenderer');
  if (paragraphs && paragraphs.length > 0) {
    return cleanText(Array.from(paragraphs).map(p => p.innerText).join('\n'), 100000);
  }

  for (const sel of [
    '.kix-appview-editor',
    '.docs-editor-container',
    '#contents',
    '[itemprop="articleBody"]',
    'article',
    '[role="main"]',
  ]) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length > 50) return cleanText(text, 100000);
    }
  }

  return cleanText(document.body?.innerText || document.body?.textContent || '', 100000);
}

// ── Basic content (non-AI tabs) ───────────────────────────────────────────────

function getBasicContent() {
  const url = window.location.href;
  try {
    if (isAITab(url)) {
      const msgs = extractStructuredMessages();
      if (msgs.length > 0) return msgs.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');
    }

    if (url.includes("youtube.com")) {
      const title = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata, #title h1')?.innerText;
      const description = document.querySelector('#description-inline-expander, #description')?.innerText;
      if (title || description) {
        return cleanText(`YouTube Video Title: ${title || 'Unknown'}\n\nDescription:\n${description || ''}`, 100000);
      }
    }

    if (url.includes("docs.google.com")) {
      const paragraphs = document.querySelectorAll('.kix-paragraphrenderer');
      if (paragraphs && paragraphs.length > 0) {
        return cleanText(Array.from(paragraphs).map(p => p.innerText).join('\n'), 100000);
      }
    }

    const el = document.querySelector('main, [role="main"], article, .content, #content, .kix-appview-editor, .docs-texteventtarget-iframe, #main') || document.body;
    return cleanText(el.innerText || el.textContent, 100000);
  } catch (e) {
    console.error('[ContextMind] getBasicContent:', e);
    return '';
  }
}

// ── Manual scroll-to-load (full popup save for very long ChatGPT threads) ─────

function findScrollContainer() {
  let best = null;
  let bestScroll = 200;
  for (const el of document.querySelectorAll('div, main, section')) {
    const ov = getComputedStyle(el).overflowY;
    if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight - el.clientHeight > bestScroll) {
      bestScroll = el.scrollHeight - el.clientHeight;
      best = el;
    }
  }
  return best;
}

async function scrollToLoadAllMessages() {
  const scroller = findScrollContainer();
  if (!scroller || scroller.scrollTop === 0) return;

  const originalTop = scroller.scrollTop;
  const STEP = 1500;
  const WAIT = 250;

  let pos = originalTop;
  while (pos > 0) {
    pos = Math.max(0, pos - STEP);
    scroller.scrollTop = pos;
    await new Promise(r => setTimeout(r, WAIT));
  }
  await new Promise(r => setTimeout(r, 400));
  scroller.scrollTop = originalTop;
  await new Promise(r => setTimeout(r, 50));
}

// ── buildStructuredData (manual save) ────────────────────────────────────────

function buildStructuredData() {
  const url  = window.location.href;
  const isAI = isAITab(url);
  const data = { url, title: document.title, isAITab: isAI };

  if (isAI) {
    const msgs = extractStructuredMessages();
    if (msgs.length > 0) data.messages = msgs;
    else {
      const text = getBasicContent();
      if (text.length > 20) data.content = text;
    }
  } else {
    const text = getBasicContent();
    if (text.length > 20) data.content = text;
  }
  return data;
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const url      = window.location.href;
  const isChatGPT = url.includes('chat.openai.com') || url.includes('chatgpt.com');

  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }

  if (request.action === 'getStructuredData' || request.action === 'getAllTabData') {
    (async () => {
      const isGDocs = url.includes('docs.google.com');
      if (isChatGPT) await scrollToLoadAllMessages();

      let structuredData;
      if (isGDocs) {
        const content = await getGoogleDocsContent();
        structuredData = { url, title: document.title, isAITab: false, content };
      } else {
        structuredData = buildStructuredData();
      }

      if (request.action === 'getAllTabData') {
        const content = isGDocs ? structuredData.content : getBasicContent();
        sendResponse({ structuredData, content });
      } else {
        sendResponse({ structuredData });
      }
    })();
    return true;
  }

  if (request.action === 'getContent') {
    (async () => {
      if (url.includes('docs.google.com')) {
        sendResponse({ content: await getGoogleDocsContent() });
      } else {
        if (isChatGPT) await scrollToLoadAllMessages();
        sendResponse({ content: getBasicContent() });
      }
    })();
    return true;
  }

  return true;
});

// ── Init auto-save ────────────────────────────────────────────────────────────
// Only run auto-save in the top-level frame to avoid duplicate POSTs from iframes.

if (window === window.top) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoSave);
  } else {
    setupAutoSave();
  }
}
