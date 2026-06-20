import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const retainedProfileRoot = path.join('src', 'lib', 'profile');
const productExts = new Set(['.js', '.svelte', '.ts']);
const retainedProfileRuntimePattern =
  /['"](?:\$lib\/profile\/profile-runtime|src\/lib\/profile\/profile-runtime|(?:\.\.\/)+profile\/profile-runtime)(?:\.|['"])/;

export async function checkProfileDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || isRetainedProfileSource(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    if (retainedProfileRuntimePattern.test(text)) {
      problems.push({
        file: rel,
        message:
          'retained profile runtime must not be imported by product source',
      });
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}

function isRetainedProfileSource(rel: string): boolean {
  return rel.startsWith(`${retainedProfileRoot}${path.sep}`);
}
