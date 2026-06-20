import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const retainedThreadRoot = path.join('src', 'lib', 'thread');
const productExts = new Set(['.js', '.svelte', '.ts']);
const retainedThreadRuntimePattern =
  /['"](?:\$lib\/thread\/thread-runtime|src\/lib\/thread\/thread-runtime|(?:\.\.\/)+thread\/thread-runtime)(?:\.|['"])/;

export async function checkThreadDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || isRetainedThreadSource(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    if (retainedThreadRuntimePattern.test(text)) {
      problems.push({
        file: rel,
        message:
          'retained thread runtime must not be imported by product source',
      });
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}

function isRetainedThreadSource(rel: string): boolean {
  return rel.startsWith(`${retainedThreadRoot}${path.sep}`);
}
