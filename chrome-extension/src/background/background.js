chrome.runtime.onInstalled.addListener(() => {
  console.log("ContextMind extension installed!");
  chrome.storage.local.set({ installed: true });
});

// Listen for Clerk token updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.clerkToken) {
    console.log("Clerk token updated");
  }
});
