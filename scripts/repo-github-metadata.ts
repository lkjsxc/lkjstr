import fs from 'node:fs/promises';
import path from 'node:path';

export type GithubMetadataProblem = { file: string; message: string };

export async function checkGithubMetadataReadme(
  root: string,
): Promise<GithubMetadataProblem[]> {
  const problems: GithubMetadataProblem[] = [];
  if (await exists(path.join(root, '.github', 'README.md')))
    problems.push({
      file: path.join('.github', 'README.md'),
      message: 'use .github/_README.md so GitHub shows root README.md',
    });
  if (!(await exists(path.join(root, '.github', '_README.md'))))
    problems.push({
      file: path.join('.github', '_README.md'),
      message: 'missing GitHub metadata index',
    });
  return problems;
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}
