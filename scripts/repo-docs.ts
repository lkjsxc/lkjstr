import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { trackedDirs } from './repo-readmes';

export type RepoProblem = { file: string; message: string };
const run = promisify(execFile);
const banned = /\b(legacy|v[0-9]+|version(?:s|ed|ing)?)\b/i;

export async function checkDocs(
  root: string,
  files: readonly string[],
  skipDirs: ReadonlySet<string>,
): Promise<RepoProblem[]> {
  const problems: RepoProblem[] = [];
  const docs = files
    .map((file) => path.relative(root, file))
    .filter((rel) => isDoc(rel, path.extname(rel)));
  for (const rel of docs) {
    const text = await fs.readFile(path.join(root, rel), 'utf8');
    checkH1First(problems, rel, text);
    checkPurpose(problems, rel, text);
    checkAscii(problems, rel, text);
    if (!rel.endsWith('LICENSE')) checkBanned(problems, rel, text);
  }
  await checkDocsTopology(problems, root, files, skipDirs);
  await checkIgnoredDocs(problems, root, docs);
  await checkReadmeTocs(problems, root, skipDirs);
  return problems;
}

function checkH1First(problems: RepoProblem[], file: string, text: string) {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  if (!first.startsWith('# '))
    problems.push({ file, message: 'documentation must start with an H1' });
}

function checkPurpose(problems: RepoProblem[], file: string, text: string) {
  if (!/^## Purpose$/m.test(text))
    problems.push({ file, message: 'documentation must include Purpose' });
}

function checkAscii(problems: RepoProblem[], file: string, text: string) {
  if ([...text].some((char) => char.charCodeAt(0) > 0x7f))
    problems.push({ file, message: 'documentation must be ASCII-only' });
}

function checkBanned(problems: RepoProblem[], file: string, text: string) {
  if (banned.test(text))
    problems.push({
      file,
      message: 'contains banned release shorthand wording',
    });
}

async function checkDocsTopology(
  problems: RepoProblem[],
  root: string,
  files: readonly string[],
  skipDirs: ReadonlySet<string>,
) {
  const dirs = await walkDirs(path.join(root, 'docs'), skipDirs);
  const docsFiles = new Set(files.map((f) => path.relative(root, f)));
  for (const dir of dirs) {
    const relDir = path.relative(root, dir);
    const readme = path.join(relDir, 'README.md');
    if (!docsFiles.has(readme))
      problems.push({ file: relDir, message: 'missing README.md' });
    const children = (await fs.readdir(dir)).filter(
      (name) => name !== 'README.md',
    );
    if (children.length < 2)
      problems.push({ file: relDir, message: 'needs at least two children' });
  }
}

async function checkIgnoredDocs(
  problems: RepoProblem[],
  root: string,
  docs: readonly string[],
) {
  const ignored = await gitCheckIgnored(root, [
    ...docs,
    'docs/architecture/data/probe.md',
  ]);
  for (const file of ignored)
    problems.push({ file, message: 'documentation path is ignored' });
}

async function checkReadmeTocs(
  problems: RepoProblem[],
  root: string,
  skipDirs: ReadonlySet<string>,
) {
  const tracked = await trackedFiles(root);
  const trackedSet = new Set(tracked);
  const dirs = await trackedDirs(root, skipDirs);
  for (const dir of dirs) {
    const readme = dir === '.' ? 'README.md' : path.join(dir, 'README.md');
    if (!trackedSet.has(readme)) continue;
    const text = await fs.readFile(path.join(root, readme), 'utf8');
    const expected = readme.startsWith(`docs${path.sep}`)
      ? docsDescendants(tracked, dir, readme)
      : localChildren(tracked, dir, readme);
    for (const target of expected) {
      if (!tocMentions(text, target))
        problems.push({ file: readme, message: `TOC missing ${target}` });
    }
  }
}

function docsDescendants(
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

function localChildren(
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

function tocMentions(text: string, target: string): boolean {
  return text.includes(`](${target})`) || text.includes(`\`${target}\``);
}

async function trackedFiles(root: string): Promise<string[]> {
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

async function gitCheckIgnored(root: string, files: readonly string[]) {
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

function isDoc(rel: string, ext: string) {
  return (
    rel === 'README.md' ||
    rel.endsWith(`${path.sep}README.md`) ||
    rel === 'AGENTS.md' ||
    (rel.startsWith(`docs${path.sep}`) && ext === '.md')
  );
}

async function walkDirs(dir: string, skipDirs: ReadonlySet<string>) {
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
