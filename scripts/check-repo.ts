import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { checkComposeGuardrails } from './repo-compose';
import { checkDocs } from './repo-docs';
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
const problems: Problem[] = [];

const files = await walk(root);
await checkLines(files);
await checkReadmeCoverage();
problems.push(...(await checkDocs(root, files, skipDirs)));
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
    }
    if (isSource(rel, ext)) checkLimit(rel, text, 200, 'source');
  }
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
