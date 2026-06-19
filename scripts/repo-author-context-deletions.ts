import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const deletedAuthorContext = path.join('src', 'lib', 'author-context');
const productExts = new Set(['.js', '.svelte', '.ts']);
const deletedPatterns = [
  {
    pattern: /loadAuthorContext|AuthorContextRequest/,
    message: 'deleted author-context loader symbols must not be imported',
  },
] as const;

export async function checkAuthorContextDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || isDeletedTarget(rel)) continue;
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

function isDeletedTarget(rel: string): boolean {
  return (
    rel === deletedAuthorContext ||
    rel.startsWith(`${deletedAuthorContext}${path.sep}`)
  );
}
