import fs from 'node:fs/promises';
import path from 'node:path';

export type RepoProblem = { file: string; message: string };

const requiredTaskHeadings = [
  'Purpose',
  'Status',
  'Current Evidence',
  'Next Edit',
  'Files To Read',
  'Files To Touch',
  'Focused Gate',
  'Acceptance',
  'Must Not',
] as const;

export async function checkTaskDocShape(
  root: string,
  files: readonly string[],
): Promise<RepoProblem[]> {
  const problems: RepoProblem[] = [];
  const taskPrefix = `docs${path.sep}execution${path.sep}tasks${path.sep}`;
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isTaskDoc(rel, taskPrefix)) continue;
    const text = await fs.readFile(file, 'utf8');
    for (const heading of requiredTaskHeadings) {
      if (!hasHeading(text, heading)) {
        problems.push({ file: rel, message: `task doc missing ${heading}` });
      }
    }
  }
  return problems;
}

function isTaskDoc(rel: string, taskPrefix: string): boolean {
  return (
    rel.startsWith(taskPrefix) &&
    rel.endsWith('.md') &&
    rel !== path.join('docs', 'execution', 'tasks', 'README.md')
  );
}

function hasHeading(text: string, heading: string): boolean {
  return text.split(/\r?\n/).some((line) => line === `## ${heading}`);
}
