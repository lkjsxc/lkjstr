import fs from 'node:fs/promises';
import path from 'node:path';

export type ComposeProblem = { file: string; message: string };

export async function checkComposeGuardrails(
  root: string,
): Promise<ComposeProblem[]> {
  const problems: ComposeProblem[] = [];
  const hasLegacyCompose = await fs
    .access(path.join(root, 'compose.yaml'))
    .then(() => true)
    .catch(() => false);
  if (hasLegacyCompose)
    problems.push({ file: 'compose.yaml', message: 'use docker-compose.yml' });
  const text = await fs
    .readFile(path.join(root, 'docker-compose.yml'), 'utf8')
    .catch(() => '');
  if (!text) return [{ file: 'docker-compose.yml', message: 'missing' }];
  const checks: [RegExp, string][] = [
    [/^\s*develop\s*:/m, 'defines Compose develop'],
    [/^\s*watch\s*:/m, 'defines Compose watch sync'],
    [/^\s*-\s*(?:\.|\.\.?\/[^:]+):/m, 'mounts the source tree'],
    [/^\s*source\s*:\s*(?:\.|\.\.?\/)/m, 'mounts the source tree'],
  ];
  for (const [pattern, message] of checks) {
    if (pattern.test(text))
      problems.push({ file: 'docker-compose.yml', message });
  }
  return problems;
}
