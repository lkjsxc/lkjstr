import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAuthorContextDeletionGuard } from '../../scripts/repo-author-context-deletions';

describe('repo author-context deletion guard', () => {
  it('rejects product use of deleted author-context loader symbols', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-author-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-author-context.ts',
      "import { loadAuthorContext } from '../author-context/load-author-context';",
    );
    const deleted = await write(
      root,
      'src/lib/author-context/load-author-context.ts',
      'export type AuthorContextRequest = { eventId: string };',
    );

    await expect(
      checkAuthorContextDeletionGuard(root, [product, deleted]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-author-context.ts',
        ),
        message: 'deleted author-context loader symbols must not be imported',
      },
    ]);
  });

  it('allows retained author-context tab and island routing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-author-'));
    const product = await write(
      root,
      'src/lib/components/workspace/retained-author-context-island.ts',
      "export const route = 'author-context';",
    );

    await expect(
      checkAuthorContextDeletionGuard(root, [product]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
