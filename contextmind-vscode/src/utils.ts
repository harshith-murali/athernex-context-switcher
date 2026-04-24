// ─────────────────────────────────────────────────────────────
//  ContextMind · utils.ts
//  Pure, side-effect-free helper utilities.
// ─────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';

/**
 * Extract `above` lines before and `below` lines after a cursor line
 * from a multi-line string.  Falls back to full content for small files.
 */
export function extractLinesAroundCursor(
  content: string,
  cursorLine: number,   // 0-indexed (VS Code native)
  above: number = 100,
  below: number = 100
): string {
  const lines = content.split('\n');

  // If the file is small enough, return everything
  if (lines.length <= above + below + 1) {
    return content;
  }

  const start = Math.max(0, cursorLine - above);
  const end   = Math.min(lines.length - 1, cursorLine + below);
  return lines.slice(start, end + 1).join('\n');
}

/**
 * Safely read a file by absolute path.
 * Returns the content string on success, or '' on any error.
 */
export function safeFileRead(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) { return ''; }
    const stat = fs.statSync(filePath);
    // Skip files larger than 1 MB
    if (stat.size > 1_048_576) { return ''; }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Resolve a filename relative to a workspace root.
 * Returns '' when not found.
 */
export function resolveFromRoot(root: string, filename: string): string {
  const candidate = path.join(root, filename);
  return fs.existsSync(candidate) ? candidate : '';
}

/**
 * Return the first `n` lines of a string.
 */
export function firstNLines(content: string, n: number): string {
  return content.split('\n').slice(0, n).join('\n');
}

/**
 * Async sleep helper.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Strip values from a .env-formatted string and return only keys.
 *
 * Handles lines of the form:
 *   KEY=value
 *   export KEY=value
 *   # comment  (skipped)
 */
export function extractEnvKeys(envContent: string): string[] {
  const keys: string[] = [];
  for (const raw of envContent.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) { continue; }
    // Strip optional "export " prefix
    const stripped = line.replace(/^export\s+/, '');
    const eq = stripped.indexOf('=');
    if (eq > 0) {
      const key = stripped.slice(0, eq).trim();
      if (key) { keys.push(key); }
    }
  }
  return keys;
}

/**
 * Simple logger – prefix every message with [ContextMind].
 */
export const log = {
  info:  (msg: string) => console.log(`[ContextMind] ${msg}`),
  warn:  (msg: string) => console.warn(`[ContextMind] WARN: ${msg}`),
  error: (msg: string, e?: unknown) => console.error(`[ContextMind] ERROR: ${msg}`, e ?? ''),
};
