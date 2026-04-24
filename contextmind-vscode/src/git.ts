// ─────────────────────────────────────────────────────────────
//  ContextMind · git.ts
//  Captures git branch and diff via child_process.
//  All errors are swallowed gracefully (non-git repos are safe).
// ─────────────────────────────────────────────────────────────

import { execSync } from 'child_process';
import { log } from './utils';

const GIT_DIFF_LINE_LIMIT = 100;

/**
 * Run a git command synchronously in the given working directory.
 * Returns stdout trimmed, or '' on any error.
 */
function runGit(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Get the current branch name.
 * Returns 'unknown' when the cwd is not inside a git repo.
 */
export function getGitBranch(cwd: string): string {
  const branch = runGit('rev-parse --abbrev-ref HEAD', cwd);
  if (!branch) {
    log.warn('Could not determine git branch (not a git repo?)');
    return 'unknown';
  }
  return branch;
}

/**
 * Get the diff against HEAD, truncated to GIT_DIFF_LINE_LIMIT lines.
 * Returns '' when there is no diff or the cwd is not a git repo.
 */
export function getGitDiff(cwd: string): string {
  const diff = runGit('diff HEAD', cwd);
  if (!diff) { return ''; }

  const lines = diff.split('\n');
  if (lines.length <= GIT_DIFF_LINE_LIMIT) { return diff; }

  const truncated = lines.slice(0, GIT_DIFF_LINE_LIMIT).join('\n');
  return `${truncated}\n… [diff truncated at ${GIT_DIFF_LINE_LIMIT} lines]`;
}
