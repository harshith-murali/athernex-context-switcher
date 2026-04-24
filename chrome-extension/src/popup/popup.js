const WEBSITE_URL = 'http://localhost:3000';
const BACKEND_URL  = 'http://localhost:37218';

let lastSavedHash = null;

const AI_DOMAINS    = ['claude.ai','chat.openai.com','chatgpt.com','gemini.google.com','cursor.sh','perplexity.ai'];
const NOISE_DOMAINS = ['netflix.com','twitter.com','reddit.com','instagram.com','twitch.tv','spotify.com','tiktok.com'];

function isAITab(url)    { return AI_DOMAINS.some(d => url.includes(d)); }
function isNoiseTab(url) { return NOISE_DOMAINS.some(d => url.includes(d)); }

function isUsefulTab(url) {
  if (!url) return false;
  return (
    url.startsWith('http') &&
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.includes('localhost') &&
    !url.includes('127.0.0.1')
  );
}

// ── Status UI ──────────────────────────────────────────────────

function setStatus(state) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (state === 'connected') {
    dot.className    = 'status-dot connected';
    text.textContent = 'Connected';
  } else if (state === 'error') {
    dot.className    = 'status-dot error';
    text.textContent = 'Offline';
  } else {
    dot.className    = 'status-dot';
    text.textContent = 'Checking…';
  }
}

async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(3000) });
    setStatus(res.ok ? 'connected' : 'error');
  } catch {
    // backend offline — still fine, we can save via website API
    setStatus('error');
  }
}

// ── User & workspace auto-discovery ───────────────────────────

let userWorkspaces = []; // populated from the website API
let selectedWorkspaceId = null;
let isLoggedIn = false;

async function discoverUser() {
  try {
    const res = await fetch(`${WEBSITE_URL}/api/context`, {
      credentials: 'include',
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 401) {
      // Not logged in to the dashboard
      isLoggedIn = false;
      renderAuthPrompt();
      return;
    }

    if (!res.ok) throw new Error('API error');

    const data = await res.json();
    userWorkspaces = data.workspaces ?? [];
    isLoggedIn = true;
    
    // Sync the userId to the local backend so VS Code knows who is locally active
    if (data.userId) {
      fetch(`${BACKEND_URL}/local/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.userId })
      }).catch(() => {}); // silent fail if backend offline
    }

    renderWorkspaceSelector();
  } catch {
    // Website not running or user not signed in
    isLoggedIn = false;
    renderAuthPrompt();
  }
}

function renderAuthPrompt() {
  const bar = document.getElementById('workspace-bar');
  bar.innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="workspace-label">Not signed in</div>
      <div class="workspace-id" style="color:#f59e0b">
        Open the ContextMind dashboard and sign in
      </div>
    </div>
    <button class="workspace-action" id="open-dashboard-btn">Open →</button>
  `;
  document.getElementById('open-dashboard-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: `${WEBSITE_URL}/sign-in` });
  });

  // Disable save button
  document.getElementById('save-btn').disabled = true;
  document.getElementById('save-btn').textContent = 'Sign in to save';
}

function renderWorkspaceSelector() {
  const bar = document.getElementById('workspace-bar');

  if (userWorkspaces.length === 0) {
    // No workspaces yet — offer to create one
    bar.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="workspace-label">Workspace</div>
        <div class="workspace-id" style="color:#8b5cf6">No workspaces yet</div>
      </div>
      <button class="workspace-action" id="create-ws-btn">+ New</button>
    `;
    document.getElementById('create-ws-btn').addEventListener('click', createWorkspaceFromExtension);
    document.getElementById('save-btn').disabled = true;
    return;
  }

  // Auto-select the most recent workspace
  if (!selectedWorkspaceId) {
    selectedWorkspaceId = userWorkspaces[0].workspaceId;
  }

  // Persist so content scripts can auto-save without the popup being open
  chrome.storage.local.set({ autoSaveWorkspaceId: selectedWorkspaceId });

  bar.innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="workspace-label">Continue Workspace</div>
      <div class="custom-select" id="custom-workspace-select">
        <div class="select-selected" id="workspace-selected-text">Loading...</div>
        <div class="select-items select-hide" id="workspace-options"></div>
      </div>
    </div>
    <button class="workspace-action" id="btn-create-workspace">+ New</button>
  `;

  const selectedText = document.getElementById('workspace-selected-text');
  const optionsContainer = document.getElementById('workspace-options');

  // Populate options
  userWorkspaces.forEach(w => {
    const opt = document.createElement('div');
    opt.textContent = w.name;
    opt.dataset.value = w.workspaceId;
    opt.addEventListener('click', (e) => {
      selectedWorkspaceId = w.workspaceId;
      selectedText.textContent = w.name;
      optionsContainer.classList.add('select-hide');
      chrome.storage.local.set({ autoSaveWorkspaceId: w.workspaceId });
      e.stopPropagation();
    });
    optionsContainer.appendChild(opt);
  });

  // Select active/first workspace
  const active = userWorkspaces.find(w => w.workspaceId === selectedWorkspaceId) || userWorkspaces[0];
  if (active) {
    selectedWorkspaceId = active.workspaceId;
    selectedText.textContent = active.name;
  } else {
    selectedText.textContent = "No workspaces";
  }

  // Toggle dropdown
  selectedText.onclick = (e) => {
    e.stopPropagation();
    optionsContainer.classList.toggle('select-hide');
  };

  document.addEventListener('click', () => {
    optionsContainer.classList.add('select-hide');
  });

  document.getElementById('btn-create-workspace').addEventListener('click', createWorkspaceFromExtension);
  document.getElementById('save-btn').disabled = false;
}

async function createWorkspaceFromExtension() {
  const name = prompt('Workspace name:', 'My Workspace') || 'My Workspace';
  try {
    const res = await fetch(`${WEBSITE_URL}/api/workspace/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create workspace');
    const data = await res.json();
    // Re-discover to refresh the list
    await discoverUser();
    // Select the new workspace
    selectedWorkspaceId = data.workspaceId;
    const sel = document.getElementById('workspace-select');
    if (sel) sel.value = selectedWorkspaceId;
    showSuccess(`✓ Workspace "${name}" created!`);
  } catch (err) {
    showError(`Failed to create workspace: ${err.message}`);
  }
}

// ── Tab rendering ──────────────────────────────────────────────

async function renderTabs() {
  const allTabs = await new Promise(r => chrome.tabs.query({}, r));
  const tabs    = allTabs.filter(t => isUsefulTab(t.url));
  const list    = document.getElementById('tabs-list');
  list.innerHTML = '';

  tabs.forEach((tab, idx) => {
    const isChecked = !isNoiseTab(tab.url);
    const item = document.createElement('div');
    item.className = `tab-item ${isChecked ? 'selected' : ''}`;
    
    const fallbackFavicon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iI2E3OGJmYSIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNMCAydjEyYzAgMS4xLjkgMiAyIDJoMTJjMS4xIDAgMi0uOSAyLTJWQjBIMHptMiAwaDEydjEwSDJWMnoiLz48L3N2Zz4=';
    const favIconSrc = tab.favIconUrl || fallbackFavicon;

    // Badges HTML
    let badgeHtml = '';
    if (isAITab(tab.url)) badgeHtml = `<span class="badge badge-ai" style="position:absolute;bottom:6px;right:6px;">AI</span>`;
    else if (isNoiseTab(tab.url)) badgeHtml = `<span class="badge badge-noise" style="position:absolute;bottom:6px;right:6px;">Noise</span>`;

    item.innerHTML = `
      <input type="checkbox" id="tab-${idx}" data-tab-id="${tab.id}" data-url="${tab.url}" data-title="${tab.title.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''}>
      <img src="${favIconSrc}" class="tab-icon" onerror="this.src='${fallbackFavicon}'">
      <div class="tab-title" title="${tab.title.replace(/"/g, '&quot;')}">${tab.title}</div>
      ${badgeHtml}
    `;

    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const cb = item.querySelector('input');
      cb.checked = !cb.checked;
      item.classList.toggle('selected', cb.checked);
      updateTabCount();
    });

    item.querySelector('input').addEventListener('change', (e) => {
      item.classList.toggle('selected', e.target.checked);
      updateTabCount();
    });

    list.appendChild(item);
  });

  updateTabCount();
}

function updateTabCount() {
  const checked = document.querySelectorAll('#tabs-list input[type="checkbox"]:checked');
  document.getElementById('tab-count').textContent = checked.length;
}

// ── Messages ───────────────────────────────────────────────────

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
  el.className = 'status-msg error';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function showSuccess(msg) {
  const el = document.getElementById('success-msg');
  el.textContent = msg;
  el.style.display = 'block';
  el.className = 'status-msg success';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function setSavingState(active, text = 'Saving context…') {
  const bar = document.getElementById('saving-bar');
  bar.style.display = active ? 'flex' : 'none';
  document.getElementById('saving-text').textContent = text;
}

// ── Content extraction ─────────────────────────────────────────

async function ensureContentScript(tabId) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, _res => {
      if (chrome.runtime.lastError) {
        // Script not injected, let's inject it dynamically!
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn(`Failed to inject content script into tab ${tabId}: ${chrome.runtime.lastError.message}`);
            resolve(false);
          } else {
            // Give it a tiny delay to initialize
            setTimeout(() => resolve(true), 50);
          }
        });
      } else {
        resolve(true); // Already injected
      }
    });
  });
}

async function extractTabContent(tabId, url) {
  if (url && (url.includes('docs.google.com') || url.includes('youtube.com'))) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async () => {
          const href = window.location.href;
          
          if (href.includes('youtube.com')) {
            const title = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata, #title h1')?.innerText || '';
            const desc = document.querySelector('#description-inline-expander, #description')?.innerText || '';
            if (title || desc) return `YouTube Video Title: ${title}\n\nDescription:\n${desc}`;
            return document.body?.innerText?.slice(0, 50000) || '';
          }
          
          if (href.includes('docs.google.com')) {
            const docMatch = href.match(/\/document\/d\/([^/]+)/);
            if (docMatch && !href.includes('/d/e/')) {
              try {
                const res = await fetch(`https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`, { credentials: 'include' });
                if (res.ok) return (await res.text()).slice(0, 100000);
              } catch { /* ignore */ }
            }
            const paragraphs = document.querySelectorAll('.kix-paragraphrenderer');
            if (paragraphs.length > 0) return Array.from(paragraphs).map(p => p.innerText).join('\n').slice(0, 100000);
            
            const main = document.querySelector('.kix-appview-editor, .docs-editor-container, #contents, [itemprop="articleBody"]');
            return (main?.innerText || main?.textContent || document.body?.innerText || '').slice(0, 100000);
          }
        }
      });
      const text = results?.[0]?.result?.trim();
      if (text) return text;
    } catch (e) {
      console.warn('Inline extraction failed:', e);
    }
  }

  // Default: message-passing to the content script (handles ChatGPT, Claude, etc.)
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { action: 'getContent' }, res => {
      if (chrome.runtime.lastError) { resolve(''); return; }
      resolve(res?.content || '');
    });
  });
}

function extractStructuredData(tabId) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { action: 'getStructuredData' }, res => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(res?.structuredData || null);
    });
  });
}

// ── Save flow ──────────────────────────────────────────────────

async function saveContext() {
  if (!isLoggedIn || !selectedWorkspaceId) {
    showError('Sign in to the ContextMind dashboard first.');
    return;
  }

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;

  const checkboxes = document.querySelectorAll('#tabs-list input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    showError('Select at least one tab to save.');
    saveBtn.disabled = false;
    return;
  }

  setSavingState(true, 'Extracting tab content…');

  try {
    const tabs = [];
    for (const cb of checkboxes) {
      const tabId = parseInt(cb.dataset.tabId);
      if (!tabId) continue;

      // Crucial: Inject script dynamically if the tab was opened before extension reload
      await ensureContentScript(tabId);

      const content        = await extractTabContent(tabId, cb.dataset.url);
      const structuredData = await extractStructuredData(tabId);

      const entry = {
        url:     cb.dataset.url   || 'unknown',
        title:   cb.dataset.title || 'Untitled',
        content: content          || 'No content extracted',
      };

      if (structuredData?.messages?.length) {
        entry.messages = structuredData.messages;
      }

      tabs.push(entry);
    }

    // Skip if nothing changed
    const hash = JSON.stringify(tabs.map(t => ({ url: t.url, len: t.content?.length })));
    if (hash === lastSavedHash) {
      showSuccess('✓ Already up to date — no changes since last save.');
      setSavingState(false);
      saveBtn.disabled = false;
      return;
    }

    setSavingState(true, 'Saving to workspace…');

    // Save directly to the Next.js API — Clerk session cookie is sent automatically
    const res = await fetch(`${WEBSITE_URL}/api/save`, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',  // sends Clerk session cookie — no token needed!
      body: JSON.stringify({
        source:      'chrome',
        workspaceId: selectedWorkspaceId,
        timestamp:   Date.now(),
        chrome:      { tabs },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    lastSavedHash = hash;
    setSavingState(false);

    saveBtn.textContent = '✓ Saved!';
    saveBtn.classList.add('success-state');
    setTimeout(() => {
      saveBtn.textContent = 'Save Context';
      saveBtn.classList.remove('success-state');
    }, 2000);

    showSuccess(`✓ ${tabs.length} tab${tabs.length !== 1 ? 's' : ''} saved.`);
  } catch (err) {
    setSavingState(false);
    showError(`Failed: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
  }
}

// ── Event bindings ─────────────────────────────────────────────

document.getElementById('save-btn').addEventListener('click', saveContext);

document.getElementById('refresh-btn').addEventListener('click', () => {
  document.getElementById('error-msg').style.display   = 'none';
  document.getElementById('success-msg').style.display = 'none';
  renderTabs();
});

document.getElementById('btn-select-all').addEventListener('click', () => {
  document.querySelectorAll('#tabs-list input[type="checkbox"]').forEach(cb => cb.checked = true);
  updateTabCount();
});

document.getElementById('btn-select-none').addEventListener('click', () => {
  document.querySelectorAll('#tabs-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateTabCount();
});

document.getElementById('btn-select-current').addEventListener('click', async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.querySelectorAll('#tabs-list input[type="checkbox"]').forEach(cb => {
    cb.checked = (parseInt(cb.dataset.tabId) === activeTab.id);
  });
  updateTabCount();
});

// ── Init ───────────────────────────────────────────────────────

checkBackend();
discoverUser();   // auto-discovers user + workspaces via Clerk session cookie
renderTabs();
