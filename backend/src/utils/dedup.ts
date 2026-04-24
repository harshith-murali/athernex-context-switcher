export interface BrowserEntry {
  url: string;
  title: string;
  content: string;
  lastSeen: number;
}

export interface CodeEntry {
  path: string;
  content: string;
  language: string;
  lastSeen: number;
}

/**
 * Upsert incoming browser tabs into existing state.
 * Match by URL — update content + lastSeen if exists, insert if new.
 */
export function upsertBrowserState(
  existing: BrowserEntry[],
  incoming: BrowserEntry[]
): BrowserEntry[] {
  const map = new Map<string, BrowserEntry>();
  for (const entry of existing) {
    map.set(entry.url, entry);
  }
  for (const entry of incoming) {
    const prev = map.get(entry.url);
    map.set(entry.url, {
      url:      entry.url,
      title:    entry.title || prev?.title || "",
      content:  entry.content || prev?.content || "",
      lastSeen: entry.lastSeen
    });
  }
  return Array.from(map.values());
}

/**
 * Upsert incoming code files into existing state.
 * Match by path — update content + lastSeen if exists, insert if new.
 */
export function upsertCodeState(
  existing: CodeEntry[],
  incoming: CodeEntry[]
): CodeEntry[] {
  const map = new Map<string, CodeEntry>();
  for (const entry of existing) {
    map.set(entry.path, entry);
  }
  for (const entry of incoming) {
    map.set(entry.path, {
      path:     entry.path,
      content:  entry.content,
      language: entry.language || map.get(entry.path)?.language || "unknown",
      lastSeen: entry.lastSeen
    });
  }
  return Array.from(map.values());
}
