const BACKEND_URL = "http://localhost:37218";

const AI_DOMAINS = [
  "claude.ai",
  "chat.openai.com",
  "gemini.google.com",
  "cursor.sh",
  "perplexity.ai"
];

const NOISE_DOMAINS = [
  "youtube.com", "netflix.com", "twitter.com", "reddit.com",
  "instagram.com", "twitch.tv", "spotify.com", "tiktok.com"
];

function isAITab(url) {
  return AI_DOMAINS.some(domain => url.includes(domain));
}

function isNoiseTab(url) {
  return NOISE_DOMAINS.some(domain => url.includes(domain));
}

function getBadge(url) {
  if (isAITab(url)) return { text: "AI", class: "badge-ai" };
  if (isNoiseTab(url)) return { text: "Noise", class: "badge-noise" };
  return null;
}

async function getTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      resolve(tabs);
    });
  });
}

async function renderTabs() {
  const tabs = await getTabs();
  const tabsList = document.getElementById("tabs-list");
  tabsList.innerHTML = "";

  tabs.forEach((tab, idx) => {
    const item = document.createElement("div");
    item.className = "tab-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `tab-${idx}`;
    checkbox.dataset.tabId = tab.id;
    checkbox.dataset.url = tab.url;
    checkbox.dataset.title = tab.title;

    // Default: check AI and work tabs, uncheck noise
    if (isAITab(tab.url)) {
      checkbox.checked = true;
    } else if (isNoiseTab(tab.url)) {
      checkbox.checked = false;
    } else {
      checkbox.checked = true;
    }

    const label = document.createElement("label");
    label.htmlFor = `tab-${idx}`;
    label.className = "tab-info";

    const title = document.createElement("div");
    title.className = "tab-title";
    title.textContent = tab.title;

    const url = document.createElement("div");
    url.className = "tab-url";
    url.textContent = tab.url.slice(0, 50) + (tab.url.length > 50 ? "..." : "");

    label.appendChild(title);
    label.appendChild(url);

    item.appendChild(checkbox);
    item.appendChild(label);

    const badge = getBadge(tab.url);
    if (badge) {
      const badgeEl = document.createElement("span");
      badgeEl.className = `badge ${badge.class}`;
      badgeEl.textContent = badge.text;
      item.appendChild(badgeEl);
    }

    tabsList.appendChild(item);
  });
}

function showStatus(stages) {
  const container = document.getElementById("status-messages");
  container.classList.add("active");

  stages.forEach(stage => {
    setTimeout(() => {
      const el = document.getElementById(stage);
      if (el) el.style.display = "flex";
    }, 100);
  });
}

function hideStatus() {
  const container = document.getElementById("status-messages");
  container.classList.remove("active");
  ["scanning", "extracting", "fetching", "compressing", "saving"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function showError(msg) {
  const el = document.getElementById("error");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

function showSuccess(msg) {
  const el = document.getElementById("success");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

async function extractTabContent(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "getContent" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve("");
      } else {
        resolve(response?.content || "");
      }
    });
  });
}

async function savContext() {
  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;

  try {
    showStatus(["scanning", "extracting", "fetching", "compressing", "saving"]);

    const checkboxes = document.querySelectorAll("input[type='checkbox']:checked");
    if (checkboxes.length === 0) {
      showError("Please select at least one tab");
      hideStatus();
      saveBtn.disabled = false;
      return;
    }

    const tabs = [];
    for (const checkbox of checkboxes) {
      const tabId = parseInt(checkbox.dataset.tabId);
      const content = await extractTabContent(tabId);

      tabs.push({
        url: checkbox.dataset.url,
        title: checkbox.dataset.title,
        content: content || "No content extracted"
      });
    }

    const payload = {
      source: "chrome",
      timestamp: Date.now(),
      chrome: {
        tabs: tabs,
        windowId: (await chrome.windows.getCurrent()).id
      }
    };

    const token = await chrome.storage.local.get("clerkToken");
    const response = await fetch(`${BACKEND_URL}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token.clerkToken || "test-token"}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Backend error");
    }

    const result = await response.json();

    hideStatus();

    // Show summary
    const card = document.getElementById("summary-card");
    document.getElementById("summary-text").textContent = result.userSummary || "Context saved successfully!";
    card.classList.add("show");

    // Setup copy button
    document.getElementById("copy-prompt-btn").onclick = () => {
      navigator.clipboard.writeText(result.primingPrompt);
      showSuccess("Prompt copied!");
    };

    showSuccess("✅ Context saved! Session ID: " + result.sessionId.slice(0, 8));
  } catch (err) {
    console.error(err);
    hideStatus();
    showError("Failed to save context. Check console.");
  } finally {
    saveBtn.disabled = false;
  }
}

document.getElementById("save-btn").addEventListener("click", savContext);
document.getElementById("refresh-btn").addEventListener("click", () => {
  document.getElementById("summary-card").classList.remove("show");
  document.getElementById("error").style.display = "none";
  document.getElementById("success").style.display = "none";
  renderTabs();
});

renderTabs();
