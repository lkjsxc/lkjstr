import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isSkippedGeneratedPath } from './repo-doc-helpers';

const run = promisify(execFile);

export async function trackedDirs(
  root: string,
  skipDirs: ReadonlySet<string>,
): Promise<string[]> {
  const { stdout } = await run('git', ['ls-files', '-z'], { cwd: root }).catch(
    () => ({ stdout: '' }),
  );
  if (!stdout) return walkDirs(root, skipDirs);
  const dirs = new Set(['.']);
  for (const file of stdout.split('\0').filter(Boolean)) {
    const parts = file.split(path.sep);
    let current = '';
    for (let index = 0; index < parts.length - 1; index += 1) {
      current = current ? path.join(current, parts[index]!) : parts[index]!;
      if (!isSkippedGeneratedPath(current, skipDirs)) dirs.add(current);
    }
  }
  return [...dirs].sort();
}

async function walkDirs(
  root: string,
  skipDirs: ReadonlySet<string>,
): Promise<string[]> {
  const out = new Set(['.']);
  await walk(root, '', skipDirs, out);
  return [...out].sort();
}

async function walk(
  root: string,
  rel: string,
  skipDirs: ReadonlySet<string>,
  out: Set<string>,
): Promise<boolean> {
  const dir = path.join(root, rel);
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  let hasFiles = entries.some((entry) => entry.isFile());
  for (const entry of entries) {
    const next = rel ? path.join(rel, entry.name) : entry.name;
    if (!entry.isDirectory() || isSkippedGeneratedPath(next, skipDirs))
      continue;
    if (await walk(root, next, skipDirs, out)) {
      out.add(next);
      hasFiles = true;
    }
  }
  return hasFiles;
}
