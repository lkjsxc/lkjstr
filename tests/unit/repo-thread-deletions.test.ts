import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkThreadDeletionGuard } from '../../scripts/repo-thread-deletions';

describe('repo thread deletion guard', () => {
  it('rejects product imports of the retained thread runtime', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-thread-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-thread-runtime.ts',
      "import { createThreadRuntime } from '../thread/thread-runtime';",
    );

    await expect(checkThreadDeletionGuard(root, [product])).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-thread-runtime.ts',
        ),
        message:
          'retained thread runtime must not be imported by product source',
      },
    ]);
  });

  it('allows retained thread internals until deletion proof', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-thread-'));
    const retained = await write(
      root,
      'src/lib/thread/thread-runtime.ts',
      "import { loadOlderThreadPage } from './thread-runtime-pages';",
    );

    await expect(checkThreadDeletionGuard(root, [retained])).resolves.toEqual(
      [],
    );
  });

  it('allows runtime page helpers and test-only imports while retained', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-thread-'));
    const helper = await write(
      root,
      'src/lib/thread/thread-runtime-pages.ts',
      "import { storeThreadEvent } from './thread-store';",
    );
    const test = await write(
      root,
      'tests/unit/thread/thread-runtime.test.ts',
      "import { createThreadRuntime } from '../../../src/lib/thread/thread-runtime';",
    );

    await expect(
      checkThreadDeletionGuard(root, [helper, test]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
