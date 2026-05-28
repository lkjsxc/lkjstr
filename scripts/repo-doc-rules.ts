import path from 'node:path';

export const rootDocFiles = ['README.md', 'AGENTS.md'] as const;
export const canonicalRootDocLinks = [
  'docs/README.md',
  'docs/current-state.md',
] as const;

export function isStrictDoc(rel: string, ext: string): boolean {
  return (
    rootDocFiles.includes(rel as (typeof rootDocFiles)[number]) ||
    (rel.startsWith(`docs${path.sep}`) && ext === '.md')
  );
}

export function rootDocLinkProblems(
  file: string,
  text: string,
): { file: string; message: string }[] {
  if (!rootDocFiles.includes(file as (typeof rootDocFiles)[number])) return [];
  return canonicalRootDocLinks
    .filter((target) => !tocMentions(text, target))
    .map((target) => ({ file, message: `root doc missing ${target}` }));
}

export function readmeTocHeadingProblems(
  file: string,
  text: string,
): { file: string; message: string }[] {
  if (!file.endsWith('README.md')) return [];
  const problems: { file: string; message: string }[] = [];
  if (!/^## Table of Contents$/m.test(text))
    problems.push({
      file,
      message: 'README TOC heading must be Table of Contents',
    });
  const oldHeading = /^## (Contents|Documents|Tree)$/m.exec(text);
  if (oldHeading)
    problems.push({
      file,
      message: `README uses nonstandard TOC heading ${oldHeading[0]}`,
    });
  return problems;
}

export function tocMentions(text: string, target: string): boolean {
  return text.includes(`](${target})`) || text.includes(`\`${target}\``);
}
