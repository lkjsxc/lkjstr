import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const deletedRoutePlan = path.join(
  'src',
  'lib',
  'user-timeline',
  'user-timeline-route-plan.ts',
);
const productExts = new Set(['.js', '.svelte', '.ts']);
const deletedPatterns = [
  {
    pattern: /user-timeline-route-plan/,
    message: 'deleted user-timeline route-plan helper must not be imported',
  },
] as const;

export async function checkUserTimelineDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || rel === deletedRoutePlan) continue;
    const text = await fs.readFile(file, 'utf8');
    for (const deleted of deletedPatterns) {
      if (deleted.pattern.test(text)) {
        problems.push({ file: rel, message: deleted.message });
      }
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}
