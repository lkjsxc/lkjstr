import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSearchDeletionGuard } from '../../scripts/repo-search-deletions';

describe('repo search deletion guard', () => {
  it('rejects product imports of the retained search query runner', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-search-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-search-runner.ts',
      "import { searchPage } from '../search/search-query';",
    );

    await expect(checkSearchDeletionGuard(root, [product])).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-search-runner.ts',
        ),
        message:
          'retained search query runner must not be imported by product source',
      },
    ]);
  });

  it('allows retained search internals until deletion proof', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-search-'));
    const retained = await write(
      root,
      'src/lib/search/search-query.ts',
      "import { memorySearchEvents } from './search-index-memory';",
    );

    await expect(checkSearchDeletionGuard(root, [retained])).resolves.toEqual(
      [],
    );
  });

  it('allows storage tokenizers and test-only imports while retained', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-search-'));
    const storage = await write(
      root,
      'src/lib/storage/sqlite-opfs/search-index-sqlite.ts',
      "import { eventSearchTokenRows } from '$lib/search/search-tokenizer';",
    );
    const test = await write(
      root,
      'tests/unit/search/search-query.test.ts',
      "import { searchPage } from '../../../src/lib/search/search-query';",
    );

    await expect(
      checkSearchDeletionGuard(root, [storage, test]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
