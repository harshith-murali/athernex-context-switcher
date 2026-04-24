export function isUsefulUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return (
    url.startsWith("http") &&
    !url.startsWith("chrome://") &&
    !url.startsWith("chrome-extension://") &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1")
  );
}

export function hasContent(content: unknown): boolean {
  return typeof content === "string" && content.trim().length > 20;
}

export function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}
