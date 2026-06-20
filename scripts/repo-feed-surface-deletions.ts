import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const deletedFeedSurfaceHelpers = new Set([
  path.join('src', 'lib', 'feed-surface', 'feed-geometry-estimate.ts'),
  path.join('src', 'lib', 'feed-surface', 'feed-scroll-key.ts'),
  path.join('src', 'lib', 'feed-surface', 'near-end-observer.ts'),
  path.join('src', 'lib', 'feed-surface', 'notification-view-rows.ts'),
  path.join('src', 'lib', 'feed-surface', 'scroll-intent.ts'),
  path.join('src', 'lib', 'feed-surface', 'speculative-older.ts'),
  path.join('src', 'lib', 'feed-surface', 'staged-rows.ts'),
  path.join('src', 'lib', 'feed-surface', 'row-shell.ts'),
]);
const productExts = new Set(['.js', '.svelte', '.ts']);
const deletedPatterns = [
  {
    pattern: /staged-rows/,
    message: 'deleted feed-surface staged-rows.ts must not be imported',
  },
  {
    pattern: /row-shell|feedRowShells|FeedRowShell|FeedRowChrome/,
    message: 'deleted feed-surface row-shell.ts must not be imported',
  },
  {
    pattern: /feed-geometry-estimate/,
    message:
      'deleted feed-surface feed-geometry-estimate.ts must not be imported',
  },
  {
    pattern: /feed-scroll-key/,
    message: 'deleted feed-surface feed-scroll-key.ts must not be imported',
  },
  {
    pattern: /near-end-observer/,
    message: 'deleted feed-surface near-end-observer.ts must not be imported',
  },
  {
    pattern: /feed-surface\/notification-view-rows/,
    message:
      'deleted feed-surface notification-view-rows.ts must not be imported',
  },
  {
    pattern: /feed-surface\/scroll-intent/,
    message: 'deleted feed-surface scroll-intent.ts must not be imported',
  },
  {
    pattern: /speculative-older/,
    message: 'deleted feed-surface speculative-older.ts must not be imported',
  },
] as const;

export async function checkFeedSurfaceDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || deletedFeedSurfaceHelpers.has(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    for (const deleted of deletedPatterns) {
      if (deleted.pattern.test(text)) {
        problems.push({ file: rel, message: deleted.message });
        break;
      }
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}
