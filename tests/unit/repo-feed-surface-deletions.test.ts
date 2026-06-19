import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFeedSurfaceDeletionGuard } from '../../scripts/repo-feed-surface-deletions';

describe('repo feed-surface deletion guard', () => {
  it('rejects product imports of deleted feed-surface helpers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-'));
    const stagedProduct = await write(
      root,
      'src/lib/timeline/reintroduced-staged-rows.ts',
      "import { feedRowShells } from '../feed-surface/staged-rows';",
    );
    const shellProduct = await write(
      root,
      'src/lib/profile/reintroduced-row-shell.ts',
      "import { feedRowShells } from '../feed-surface/row-shell';",
    );
    const estimateProduct = await write(
      root,
      'src/lib/profile/reintroduced-feed-geometry-estimate.ts',
      "import { estimateHeightFromFeatures } from '../feed-surface/feed-geometry-estimate';",
    );
    const deleted = await Promise.all([
      write(
        root,
        'src/lib/feed-surface/feed-geometry-estimate.ts',
        'export const deletedHelper = "feed-geometry-estimate";',
      ),
      write(
        root,
        'src/lib/feed-surface/staged-rows.ts',
        'export const deletedHelper = true;',
      ),
      write(
        root,
        'src/lib/feed-surface/row-shell.ts',
        'export const deletedHelper = true;',
      ),
    ]);

    await expect(
      checkFeedSurfaceDeletionGuard(root, [
        stagedProduct,
        shellProduct,
        estimateProduct,
        ...deleted,
      ]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'timeline',
          'reintroduced-staged-rows.ts',
        ),
        message: 'deleted feed-surface staged-rows.ts must not be imported',
      },
      {
        file: path.join('src', 'lib', 'profile', 'reintroduced-row-shell.ts'),
        message: 'deleted feed-surface row-shell.ts must not be imported',
      },
      {
        file: path.join(
          'src',
          'lib',
          'profile',
          'reintroduced-feed-geometry-estimate.ts',
        ),
        message:
          'deleted feed-surface feed-geometry-estimate.ts must not be imported',
      },
    ]);
  });

  it('ignores the deleted helper files themselves', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-'));
    const deleted = await Promise.all([
      write(
        root,
        'src/lib/feed-surface/feed-geometry-estimate.ts',
        'export const deletedHelper = true;',
      ),
      write(
        root,
        'src/lib/feed-surface/staged-rows.ts',
        'export const deletedHelper = true;',
      ),
      write(
        root,
        'src/lib/feed-surface/row-shell.ts',
        'export const deletedHelper = true;',
      ),
    ]);

    await expect(checkFeedSurfaceDeletionGuard(root, deleted)).resolves.toEqual(
      [],
    );
  });

  it('allows retained feed-surface imports', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-'));
    const product = await write(
      root,
      'src/lib/timeline/retained-footer-phase.ts',
      "import { footerPhaseFromPaging } from '../feed-surface/footer-phase';",
    );

    await expect(
      checkFeedSurfaceDeletionGuard(root, [product]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
