import fs from 'node:fs/promises';
import path from 'node:path';

export type RepoProblem = { file: string; message: string };

const requiredSkillHeadings = [
  'Purpose',
  'Trigger',
  'Read First',
  'Files Likely Touched',
  'Procedure',
  'Focused Gate',
  'Final Gate',
  'Must Not',
  'Handoff',
] as const;

export async function checkSkillDocShape(
  root: string,
  files: readonly string[],
): Promise<RepoProblem[]> {
  const problems: RepoProblem[] = [];
  const skillPrefix = `docs${path.sep}agent${path.sep}skills${path.sep}`;
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isSkillDoc(rel, skillPrefix)) continue;
    const text = await fs.readFile(file, 'utf8');
    for (const heading of requiredSkillHeadings) {
      if (!hasHeading(text, heading)) {
        problems.push({ file: rel, message: `skill doc missing ${heading}` });
      }
    }
  }
  return problems;
}

function isSkillDoc(rel: string, skillPrefix: string): boolean {
  return (
    rel.startsWith(skillPrefix) &&
    rel.endsWith('.md') &&
    rel !== path.join('docs', 'agent', 'skills', 'README.md')
  );
}

function hasHeading(text: string, heading: string): boolean {
  return text.split(/\r?\n/).some((line) => line === `## ${heading}`);
}
