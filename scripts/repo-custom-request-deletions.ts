import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const retainedCustomRequestRoot = path.join('src', 'lib', 'custom-request');
const productExts = new Set(['.js', '.svelte', '.ts']);
const retainedCustomRequestPattern =
  /['"](?:\$lib\/custom-request|src\/lib\/custom-request|(?:\.\.\/)+custom-request)(?:\/|['"])/;

export async function checkCustomRequestDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || isRetainedCustomRequestSource(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    if (retainedCustomRequestPattern.test(text)) {
      problems.push({
        file: rel,
        message:
          'retained custom-request runtime must not be imported by product source',
      });
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}

function isRetainedCustomRequestSource(rel: string): boolean {
  return rel.startsWith(`${retainedCustomRequestRoot}${path.sep}`);
}
