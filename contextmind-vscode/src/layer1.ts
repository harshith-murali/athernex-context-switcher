// ─────────────────────────────────────────────────────────────
//  ContextMind · layer1.ts
//  Captures workspace-root metadata:
//    • package.json  (full)
//    • requirements.txt (full)
//    • .env → keys only (never values)
//    • shallow directory listing (~50 files)
// ─────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import { Layer1Context } from './types';
import { safeFileRead, extractEnvKeys, log } from './utils';

const MAX_STRUCTURE_ENTRIES = 50;

/**
 * Enumerate files under `dir` (one level deep) plus any files
 * in immediate child directories — but do NOT recurse deeper.
 * Stops at MAX_STRUCTURE_ENTRIES total entries.
 *
 * Skips: node_modules, .git, dist, build, .next, __pycache__
 */
function buildShallowStructure(root: string): string[] {
  const SKIP = new Set([
    'node_modules', '.git', 'dist', 'build', '.next',
    '__pycache__', '.venv', 'venv', '.cache',
  ]);

  const entries: string[] = [];

  function walk(dir: string, depth: number): void {
    if (entries.length >= MAX_STRUCTURE_ENTRIES) { return; }

    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const child of children) {
      if (entries.length >= MAX_STRUCTURE_ENTRIES) { break; }
      if (SKIP.has(child.name)) { continue; }

      const rel = path.relative(root, path.join(dir, child.name));
      entries.push(child.isDirectory() ? `${rel}/` : rel);

      // Recurse one extra level
      if (child.isDirectory() && depth < 1) {
        walk(path.join(dir, child.name), depth + 1);
      }
    }
  }

  walk(root, 0);
  return entries;
}

/**
 * Collect Layer-1 project metadata from the workspace root.
 */
export async function captureLayer1(workspaceRoot: string): Promise<Layer1Context> {
  log.info(`Capturing layer-1 context from: ${workspaceRoot}`);

  // package.json
  const pkgPath = path.join(workspaceRoot, 'package.json');
  const packageJson = safeFileRead(pkgPath);

  // requirements.txt
  const reqPath = path.join(workspaceRoot, 'requirements.txt');
  const requirements = safeFileRead(reqPath);

  // .env — keys only
  const envPath = path.join(workspaceRoot, '.env');
  const envContent = safeFileRead(envPath);
  const envKeys = envContent ? extractEnvKeys(envContent) : [];

  // shallow file structure
  const structure = buildShallowStructure(workspaceRoot);

  log.info(`Layer-1: ${structure.length} structure entries, ${envKeys.length} env keys`);

  return { packageJson, requirements, envKeys, structure };
}
