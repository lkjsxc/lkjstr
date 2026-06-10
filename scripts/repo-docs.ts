import fs from 'node:fs/promises';
import path from 'node:path';
import { localMarkdownLinkProblems } from './repo-doc-links';
import {
  isStrictDoc,
  readmeTocHeadingProblems,
  rootDocLinkProblems,
  tocMentions,
} from './repo-doc-rules';
import {
  trackedDirs,
  trackedFiles,
  gitCheckIgnored,
  walkDirs,
  docsDescendants,
  localChildren,
} from './repo-doc-helpers';

export type RepoProblem = { file: string; message: string };
const banned = /\b(legacy|v[0-9]+|version(?:s|ed|ing)?)\b/i;

export async function checkDocs(
  root: string,
  files: readonly string[],
  skipDirs: ReadonlySet<string>,
): Promise<RepoProblem[]> {
  const problems: RepoProblem[] = [];
  const docs = files
    .map((file) => path.relative(root, file))
    .filter((rel) => isStrictDoc(rel, path.extname(rel)));
  for (const rel of docs) {
    const text = await fs.readFile(path.join(root, rel), 'utf8');
    checkH1First(problems, rel, text);
    checkPurpose(problems, rel, text);
    checkAscii(problems, rel, text);
    if (!rel.endsWith('LICENSE')) checkBanned(problems, rel, text);
    checkProseLineLength(problems, rel, text);
    checkTableColumns(problems, rel, text);
    problems.push(...(await localMarkdownLinkProblems(root, rel, text)));
  }
  await checkDocsTopology(problems, root, files, skipDirs);
  await checkIgnoredDocs(problems, root, docs);
  await checkReadmeTocs(problems, root, skipDirs);
  const tracked = new Set(files.map((file) => path.relative(root, file)));
  for (const file of ['README.md', 'AGENTS.md']) {
    if (!tracked.has(file)) continue;
    const text = await fs.readFile(path.join(root, file), 'utf8');
    problems.push(...rootDocLinkProblems(file, text));
  }
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
    problems.push({ file, message: 'contains release shorthand' });
}

const PROSE_LINE_LIMIT = 160;

function checkProseLineLength(
  problems: RepoProblem[],
  file: string,
  text: string,
) {
  const lines = text.split(/\r?\n/);
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) inCodeBlock = !inCodeBlock;
    if (!inCodeBlock && line.length > PROSE_LINE_LIMIT && !isTableLine(line)) {
      problems.push({
        file,
        message: `line ${i + 1} exceeds ${PROSE_LINE_LIMIT} prose chars`,
      });
    }
  }
}

function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.includes('|');
}

const TABLE_COLUMN_LIMIT = 6;

function checkTableColumns(
  problems: RepoProblem[],
  file: string,
  text: string,
) {
  if (allowsWideTables(file, text)) return;
  const lines = text.split(/\r?\n/);
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) inCodeBlock = !inCodeBlock;
    if (inCodeBlock) continue;
    const columns = tableColumns(line);
    if (columns > TABLE_COLUMN_LIMIT) {
      problems.push({
        file,
        message: `line ${i + 1} has ${columns} table columns over ${TABLE_COLUMN_LIMIT}`,
      });
    }
  }
}

function tableColumns(line: string): number {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return 0;
  return Math.max(0, trimmed.split('|').length - 2);
}

function allowsWideTables(file: string, text: string): boolean {
  return (
    file.endsWith('-ledger.md') ||
    file.endsWith('table-manifest.md') ||
    /^## Matrix$/m.test(text)
  );
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
    const children = (await fs.readdir(dir, { withFileTypes: true })).filter(
      (entry) =>
        entry.name !== 'README.md' &&
        ((entry.isFile() && path.extname(entry.name) === '.md') ||
          entry.isDirectory()),
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
    problems.push(...readmeTocHeadingProblems(readme, text));
  }
}
