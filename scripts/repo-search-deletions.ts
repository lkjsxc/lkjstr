import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const retainedSearchRoot = path.join('src', 'lib', 'search');
const productExts = new Set(['.js', '.svelte', '.ts']);
const retainedSearchQueryPattern =
  /['"](?:\$lib\/search\/search-query|src\/lib\/search\/search-query|(?:\.\.\/)+search\/search-query)(?:\.|['"])/;

export async function checkSearchDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || isRetainedSearchSource(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    if (retainedSearchQueryPattern.test(text)) {
      problems.push({
        file: rel,
        message:
          'retained search query runner must not be imported by product source',
      });
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}

function isRetainedSearchSource(rel: string): boolean {
  return rel.startsWith(`${retainedSearchRoot}${path.sep}`);
}
