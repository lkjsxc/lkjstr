import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFeedSurfaceDeletionGuard } from '../../scripts/repo-feed-surface-deletions';

type DeletedHelperCase = {
  readonly helper: string;
  readonly product: string;
  readonly importText: string;
  readonly message: string;
};

const deletedHelperCases: readonly DeletedHelperCase[] = [
  {
    helper: 'src/lib/feed-surface/staged-rows.ts',
    product: 'src/lib/timeline/reintroduced-staged-rows.ts',
    importText: "import { feedRowShells } from '../feed-surface/staged-rows';",
    message: 'deleted feed-surface staged-rows.ts must not be imported',
  },
  {
    helper: 'src/lib/feed-surface/row-shell.ts',
    product: 'src/lib/profile/reintroduced-row-shell.ts',
    importText: "import { feedRowShells } from '../feed-surface/row-shell';",
    message: 'deleted feed-surface row-shell.ts must not be imported',
  },
  {
    helper: 'src/lib/feed-surface/feed-geometry-estimate.ts',
    product: 'src/lib/profile/reintroduced-feed-geometry-estimate.ts',
    importText:
      "import { estimateHeightFromFeatures } from '../feed-surface/feed-geometry-estimate';",
    message:
      'deleted feed-surface feed-geometry-estimate.ts must not be imported',
  },
  {
    helper: 'src/lib/feed-surface/feed-scroll-key.ts',
    product: 'src/lib/timeline/reintroduced-feed-scroll-key.ts',
    importText:
      "import { safeFeedRowKey } from '../feed-surface/feed-scroll-key';",
    message: 'deleted feed-surface feed-scroll-key.ts must not be imported',
  },
  {
    helper: 'src/lib/feed-surface/near-end-observer.ts',
    product: 'src/lib/timeline/reintroduced-near-end-observer.ts',
    importText:
      "import { createNearEndSentinel } from '../feed-surface/near-end-observer';",
    message: 'deleted feed-surface near-end-observer.ts must not be imported',
  },
  {
    helper: 'src/lib/feed-surface/notification-view-rows.ts',
    product: 'src/lib/tabs/notifications/reintroduced-view-rows.ts',
    importText:
      "import { notificationViewRows } from '../../feed-surface/notification-view-rows';",
    message:
      'deleted feed-surface notification-view-rows.ts must not be imported',
  },
  {
    helper: 'src/lib/feed-surface/scroll-intent.ts',
    product: 'src/lib/components/feed/reintroduced-scroll-intent.ts',
    importText:
      "import { createFeedScrollIntent } from '../../feed-surface/scroll-intent';",
    message: 'deleted feed-surface scroll-intent.ts must not be imported',
  },
  {
    helper: 'src/lib/feed-surface/speculative-older.ts',
    product: 'src/lib/timeline/reintroduced-speculative-older.ts',
    importText:
      "import { createOlderRequestCoordinator } from '../feed-surface/speculative-older';",
    message: 'deleted feed-surface speculative-older.ts must not be imported',
  },
] as const;

describe('repo feed-surface deletion guard', () => {
  it('rejects product imports of deleted feed-surface helpers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-'));
    const products = await writeProducts(root);
    const deleted = await writeDeletedHelpers(root);

    await expect(
      checkFeedSurfaceDeletionGuard(root, [...products, ...deleted]),
    ).resolves.toEqual(expectedProblems());
  });

  it('ignores the deleted helper files themselves', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-'));
    const deleted = await writeDeletedHelpers(root);

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

async function writeProducts(root: string): Promise<string[]> {
  return Promise.all(
    deletedHelperCases.map(({ product, importText }) =>
      write(root, product, importText),
    ),
  );
}

async function writeDeletedHelpers(root: string): Promise<string[]> {
  return Promise.all(
    deletedHelperCases.map(({ helper }) =>
      write(root, helper, 'export const deletedHelper = true;'),
    ),
  );
}

function expectedProblems(): { file: string; message: string }[] {
  return deletedHelperCases.map(({ product, message }) => ({
    file: toSystemPath(product),
    message,
  }));
}

function toSystemPath(rel: string): string {
  return path.join(...rel.split('/'));
}

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
