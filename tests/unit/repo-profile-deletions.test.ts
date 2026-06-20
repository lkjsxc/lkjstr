import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkProfileDeletionGuard } from '../../scripts/repo-profile-deletions';

describe('repo profile deletion guard', () => {
  it('rejects product imports of the retained profile runtime', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-profile-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-profile-runtime.ts',
      "import { createProfileRuntime } from '../profile/profile-runtime';",
    );

    await expect(checkProfileDeletionGuard(root, [product])).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-profile-runtime.ts',
        ),
        message:
          'retained profile runtime must not be imported by product source',
      },
    ]);
  });

  it('allows retained profile internals until deletion proof', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-profile-'));
    const retained = await write(
      root,
      'src/lib/profile/profile-runtime.ts',
      "import { loadInitialProfilePage } from './profile-runtime-initial';",
    );

    await expect(checkProfileDeletionGuard(root, [retained])).resolves.toEqual(
      [],
    );
  });

  it('allows profile helpers and test-only imports while retained', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-profile-'));
    const helper = await write(
      root,
      'src/lib/profile/profile-runtime-paging.ts',
      "import { profileEmptyText } from './profile-empty-text';",
    );
    const test = await write(
      root,
      'tests/unit/profile/profile-runtime.test.ts',
      "import { createProfileRuntime } from '../../../src/lib/profile/profile-runtime';",
    );

    await expect(
      checkProfileDeletionGuard(root, [helper, test]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
