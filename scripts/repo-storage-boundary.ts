import fs from 'node:fs/promises';
import path from 'node:path';

export type RepoProblem = { file: string; message: string };

const allowedPrefixes = [
  `src${path.sep}lib${path.sep}storage${path.sep}`,
  `src${path.sep}lib${path.sep}cache${path.sep}`,
];

export async function checkStorageBoundary(
  root: string,
  files: readonly string[],
): Promise<RepoProblem[]> {
  const problems: RepoProblem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isCheckedSource(rel) || isAllowedStoragePath(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    if (usesRawBrowserStorage(text))
      problems.push({
        file: rel,
        message: 'raw browser storage access must stay behind repositories',
      });
  }
  return problems;
}

function isCheckedSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}lib${path.sep}`) && rel.endsWith('.ts');
}

function isAllowedStoragePath(rel: string): boolean {
  return allowedPrefixes.some((prefix) => rel.startsWith(prefix));
}

function usesRawBrowserStorage(text: string): boolean {
  return /\b(?:globalThis|window)\.(?:indexedDB|localStorage)\b|\b(?:indexedDB|localStorage)\s*\./.test(
    text,
  );
}
