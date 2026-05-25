import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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
      if (!isSkippedPath(current, skipDirs)) dirs.add(current);
    }
  }
  return [...dirs].sort();
}

export async function trackedFiles(root: string): Promise<string[]> {
  const { stdout } = await run('git', ['ls-files', '-z'], { cwd: root }).catch(
    () => ({ stdout: '' }),
  );
  const files = stdout.split('\0').filter(Boolean).sort();
  const existing: string[] = [];
  for (const file of files) {
    await fs.access(path.join(root, file)).then(
      () => existing.push(file),
      () => undefined,
    );
  }
  return existing;
}

export async function gitCheckIgnored(
  root: string,
  files: readonly string[],
): Promise<string[]> {
  try {
    const { stdout } = await run('git', ['check-ignore', ...files], {
      cwd: root,
    });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch (error) {
    const result = error as { stdout?: string; code?: number };
    if (result.code === 1) return [];
    return (result.stdout ?? '').split(/\r?\n/).filter(Boolean);
  }
}

export async function walkDirs(
  dir: string,
  skipDirs: ReadonlySet<string>,
): Promise<string[]> {
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  const out = [dir];
  for (const entry of entries) {
    if (entry.isDirectory() && !skipDirs.has(entry.name))
      out.push(...(await walkDirs(path.join(dir, entry.name), skipDirs)));
  }
  return out;
}

export function docsDescendants(
  tracked: readonly string[],
  dir: string,
  readme: string,
) {
  const prefix = dir === '.' ? '' : `${dir}${path.sep}`;
  return tracked
    .filter((file) => file.startsWith(prefix))
    .filter((file) => file !== readme && path.extname(file) === '.md')
    .map((file) => path.relative(dir, file))
    .sort();
}

export function localChildren(
  tracked: readonly string[],
  dir: string,
  readme: string,
) {
  const prefix = dir === '.' ? '' : `${dir}${path.sep}`;
  const trackedSet = new Set(tracked);
  const children = new Set<string>();
  for (const file of tracked) {
    if (!file.startsWith(prefix) || file === readme) continue;
    const rel = path.relative(dir, file);
    if (rel.startsWith('..') || rel.includes(`${path.sep}.`)) continue;
    const [first, second] = rel.split(path.sep);
    if (!first) continue;
    if (second && trackedSet.has(path.join(dir, first, 'README.md'))) {
      children.add(`${first}/`);
      continue;
    }
    if (!second && path.extname(first) === '.md') children.add(first);
  }
  return [...children].sort();
}

function isSkippedPath(rel: string, skipDirs: ReadonlySet<string>): boolean {
  return rel.split(path.sep).some((part) => skipDirs.has(part));
}
