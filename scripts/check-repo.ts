import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkComposeGuardrails } from './repo-compose';
import { trackedDirs } from './repo-readmes';

type Problem = { file: string; message: string };

const root = process.cwd();
const skipDirs = new Set([
  '.git',
  '.pnpm-store',
  '.svelte-kit',
  'build',
  'coverage',
  'data',
  'node_modules',
  'test-results',
  'tmp',
]);
const sourceExts = new Set(['.css', '.html', '.js', '.svelte', '.ts']);
const banned = /\b(v[0-9]+|version(?:s|ed|ing)?)\b/i;
const problems: Problem[] = [];
const run = promisify(execFile);

const files = await walk(root);
await checkLines(files);
await checkReadmeCoverage();
await checkDocsTopology(files);
await checkIgnoredDocs(files);
problems.push(...(await checkComposeGuardrails(root)));

for (const problem of problems.sort((a, b) => a.file.localeCompare(b.file))) {
  console.error(`${problem.file}: ${problem.message}`);
}

if (problems.length > 0) process.exitCode = 1;

async function checkLines(filesToCheck: string[]) {
  for (const file of filesToCheck) {
    const rel = path.relative(root, file);
    const ext = path.extname(rel);
    const text = await fs.readFile(file, 'utf8');
    if (isDoc(rel, ext)) {
      checkLimit(rel, text, 300, 'docs');
      checkH1First(rel, text);
      checkPurpose(rel, text);
      if (!rel.endsWith('LICENSE')) checkBanned(rel, text);
    }
    if (isSource(rel, ext)) checkLimit(rel, text, 200, 'source');
  }
}

function checkH1First(file: string, text: string) {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  if (!first.startsWith('# '))
    problems.push({ file, message: 'documentation must start with an H1' });
}

function checkPurpose(file: string, text: string) {
  if (!/^## Purpose$/m.test(text))
    problems.push({ file, message: 'documentation must include Purpose' });
}

async function checkReadmeCoverage() {
  const dirs = await trackedDirs(root, skipDirs);
  for (const dir of dirs) {
    const readme = dir === '.' ? 'README.md' : path.join(dir, 'README.md');
    await fs.access(path.join(root, readme)).catch(() => {
      problems.push({ file: dir, message: 'missing README.md' });
    });
  }
}

async function checkDocsTopology(filesToCheck: string[]) {
  const docsRoot = path.join(root, 'docs');
  const dirs = await walkDirs(docsRoot);
  const docsFiles = new Set(filesToCheck.map((f) => path.relative(root, f)));
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

async function checkIgnoredDocs(filesToCheck: string[]) {
  const candidates = filesToCheck
    .map((file) => path.relative(root, file))
    .filter((rel) => isDoc(rel, path.extname(rel)));
  candidates.push('docs/architecture/data/probe.md');
  const ignored = await gitCheckIgnored(candidates);
  for (const file of ignored)
    problems.push({ file, message: 'documentation path is ignored' });
}

async function gitCheckIgnored(filesToCheck: readonly string[]) {
  try {
    const { stdout } = await run('git', ['check-ignore', ...filesToCheck], {
      cwd: root,
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    const result = error as { stdout?: string; code?: number };
    if (result.code === 1) return [];
    return (result.stdout ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
}

function checkLimit(file: string, text: string, limit: number, kind: string) {
  const lines =
    text.length === 0
      ? 0
      : text.endsWith('\n')
        ? text.split('\n').length - 1
        : text.split('\n').length;
  if (lines > limit)
    problems.push({
      file,
      message: `${kind} file has ${lines} lines over limit ${limit}`,
    });
}

function checkBanned(file: string, text: string) {
  if (banned.test(text))
    problems.push({
      file,
      message: 'contains banned release shorthand wording',
    });
}

function isDoc(rel: string, ext: string) {
  return (
    rel === 'README.md' ||
    rel.endsWith(`${path.sep}README.md`) ||
    rel === 'AGENTS.md' ||
    (rel.startsWith(`docs${path.sep}`) && ext === '.md')
  );
}

function isSource(rel: string, ext: string) {
  return (
    (rel.startsWith(`src${path.sep}`) ||
      rel.startsWith(`scripts${path.sep}`) ||
      rel.startsWith(`tests${path.sep}`)) &&
    sourceExts.has(ext)
  );
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(next)));
    if (entry.isFile()) out.push(next);
  }
  return out;
}

async function walkDirs(dir: string): Promise<string[]> {
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  const out = [dir];
  for (const entry of entries) {
    if (entry.isDirectory() && !skipDirs.has(entry.name))
      out.push(...(await walkDirs(path.join(dir, entry.name))));
  }
  return out;
}
