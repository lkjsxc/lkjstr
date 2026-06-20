import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const retainedFollowGraphRoot = path.join('src', 'lib', 'follow-graph');
const retainedUserTimelineRoot = path.join('src', 'lib', 'user-timeline');
const productExts = new Set(['.js', '.svelte', '.ts']);
const retainedFollowGraphPattern =
  /['"](?:\$lib\/follow-graph|src\/lib\/follow-graph|(?:\.\.\/)+follow-graph)(?:\/|['"])/;

export async function checkFollowGraphDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (
      !isProductSource(rel) ||
      isRetainedFollowGraphSource(rel) ||
      isRetainedUserTimelineSource(rel)
    )
      continue;
    const text = await fs.readFile(file, 'utf8');
    if (retainedFollowGraphPattern.test(text)) {
      problems.push({
        file: rel,
        message:
          'retained follow-graph runtime must not be imported by product source',
      });
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}

function isRetainedFollowGraphSource(rel: string): boolean {
  return rel.startsWith(`${retainedFollowGraphRoot}${path.sep}`);
}

function isRetainedUserTimelineSource(rel: string): boolean {
  return rel.startsWith(`${retainedUserTimelineRoot}${path.sep}`);
}
