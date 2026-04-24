chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContent") {
    let content = "";

    // Special handling for Claude AI conversations
    if (window.location.href.includes("claude.ai")) {
      const conversationEl = document.querySelector("[data-testid='conversation']") ||
                             document.querySelector(".react-scroll-to-bottom");
      if (conversationEl) {
        content = conversationEl.innerText;
      }
    }
    // Special handling for ChatGPT
    else if (window.location.href.includes("chat.openai.com")) {
      const messagesEl = document.querySelector("[role='region']");
      if (messagesEl) {
        content = messagesEl.innerText;
      }
    }
    // Default: get all text content
    else {
      content = document.body.innerText;
    }

    sendResponse({ content: content || "" });
  }
});
