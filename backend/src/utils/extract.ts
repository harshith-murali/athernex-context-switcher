// Lightweight ML-style classifiers and extractors for chat messages

export type MessageType = 'code' | 'error' | 'decision' | 'question' | 'explanation' | 'ack';

/** Rule-based message classifier */
export function classifyMessage(role: string, content: string): MessageType {
  if (/```[\s\S]+?```/.test(content)) return 'code';

  if (/\b(error|exception|traceback|failed|cannot|undefined is not|null pointer|TypeError|SyntaxError|ReferenceError|ImportError|ModuleNotFoundError|404|500|ENOENT|ECONNREFUSED)\b/i.test(content))
    return 'error';

  if (/\b(decided|decision|we('ll| will)|I('ll| will)|let's use|using|going with|approach is|strategy is|solution is|fixed by|resolved|the plan)\b/i.test(content))
    return 'decision';

  if (/\?/.test(content.trimEnd()) && /^(how|what|why|when|where|can|could|should|is there|are there|do you|would)/i.test(content.trim()))
    return 'question';

  if (role === 'assistant' && content.length > 300) return 'explanation';

  return 'ack';
}

/** Importance score (higher = more worth keeping in summary) */
export function scoreMessage(type: MessageType, content: string): number {
  const base: Record<MessageType, number> = {
    code:        10,
    error:        8,
    decision:     6,
    explanation:  4,
    question:     3,
    ack:          1,
  };

  let score = base[type];

  // Bonus for multiple code blocks
  const blocks = (content.match(/```/g) ?? []).length / 2;
  score += Math.floor(blocks) * 3;

  // Bonus for length — long assistant replies = deep explanation
  if (content.length > 1000) score += 2;
  if (content.length > 4000) score += 2;

  return score;
}

/** Extract fenced code blocks from a message */
export function extractCodeBlocks(text: string): string[] {
  const matches = text.match(/```[\s\S]*?```/g) ?? [];
  return matches
    .map(m => m.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim())
    .filter(b => b.length > 10);
}

/** TF-IDF-inspired key term extractor */
export function extractKeyTerms(text: string): string[] {
  const terms = new Set<string>();

  // PascalCase — component / class names
  (text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) ?? []).forEach(t => terms.add(t));

  // camelCase — functions / variables
  (text.match(/\b[a-z]{2,}[A-Z][a-zA-Z0-9]+\b/g) ?? []).forEach(t => terms.add(t));

  // Error / exception names
  (text.match(/\b\w+(?:Error|Exception|Warning|Issue)\b/g) ?? []).forEach(t => terms.add(t));

  // File names with extensions
  (text.match(/\b[\w/-]+\.(ts|tsx|js|jsx|py|go|rs|java|css|scss|json|yaml|toml|sql|md|env)\b/g) ?? []).forEach(t => terms.add(t));

  // Known frameworks / tech (frequency-weighted by appearing in list)
  const techPattern = /\b(React|Vue|Angular|Next\.?js|Nuxt|Express|Fastify|FastAPI|Flask|Django|PostgreSQL|MySQL|SQLite|MongoDB|Redis|Prisma|Drizzle|Mongoose|Docker|Kubernetes|TypeScript|JavaScript|Python|Rust|Go|Java|GraphQL|REST|JWT|OAuth|tRPC|Tailwind|Bootstrap|Socket\.io|WebSocket|Axios|Fetch|Vite|Webpack|Rollup|ESLint|Prettier)\b/g;
  (text.match(techPattern) ?? []).forEach(t => terms.add(t));

  // Route / endpoint patterns
  (text.match(/\/(api|auth|users?|admin|v\d+)\/[\w/:]+/g) ?? []).forEach(t => terms.add(t));

  return [...terms].slice(0, 30);
}

/** Stable fingerprint for dedup (immune to whitespace changes) */
export function fingerprint(content: string): string {
  const norm = content.replace(/\s+/g, ' ').trim();
  return `${norm.slice(0, 120)}|${norm.slice(-60)}|${norm.length}`;
}

/** Filter incoming messages that are not already in existing history */
export function deduplicateMessages<T extends { content: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const seen = new Set(existing.map(m => fingerprint(m.content)));
  return incoming.filter(m => !seen.has(fingerprint(m.content)));
}
