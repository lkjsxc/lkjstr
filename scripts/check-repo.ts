import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

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
  'tmp',
]);
const sourceExts = new Set(['.css', '.html', '.js', '.svelte', '.ts']);
const banned = /\b(v[0-9]+|version(?:s|ed|ing)?)\b/i;
const problems: Problem[] = [];

const files = await walk(root);
await checkLines(files);
await checkDocsTopology(files);

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
      if (!rel.endsWith('LICENSE')) checkBanned(rel, text);
    }
    if (isSource(rel, ext)) checkLimit(rel, text, 200, 'source');
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
