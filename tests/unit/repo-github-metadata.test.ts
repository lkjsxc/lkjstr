import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkGithubMetadataReadme } from '../../scripts/repo-github-metadata';

describe('GitHub metadata documentation guard', () => {
  it('accepts _README.md without README.md', async () => {
    const root = await fixture({ underscore: true });

    await expect(checkGithubMetadataReadme(root)).resolves.toEqual([]);
  });

  it('rejects README.md because it hides the project overview', async () => {
    const root = await fixture({ rootReadme: true, underscore: true });

    await expect(checkGithubMetadataReadme(root)).resolves.toEqual([
      {
        file: path.join('.github', 'README.md'),
        message: 'use .github/_README.md so GitHub shows root README.md',
      },
    ]);
  });

  it('requires a metadata index', async () => {
    const root = await fixture({});

    await expect(checkGithubMetadataReadme(root)).resolves.toEqual([
      {
        file: path.join('.github', '_README.md'),
        message: 'missing GitHub metadata index',
      },
    ]);
  });
});

async function fixture(options: {
  readonly rootReadme?: boolean;
  readonly underscore?: boolean;
}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-github-'));
  const dir = path.join(root, '.github');
  await fs.mkdir(dir, { recursive: true });
  if (options.rootReadme)
    await fs.writeFile(path.join(dir, 'README.md'), '# GitHub\n');
  if (options.underscore)
    await fs.writeFile(path.join(dir, '_README.md'), '# GitHub\n');
  return root;
}
