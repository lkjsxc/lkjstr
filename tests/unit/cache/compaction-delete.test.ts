import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheLedgerRecord } from '../../../src/lib/cache/cache-ledger-record';

const mocks = vi.hoisted(() => ({
  compactFeedCoverage: vi.fn(),
  sqliteDeleteEventCacheRows: vi.fn(),
  sqliteDeleteDirectCacheRows: vi.fn(),
}));

vi.mock('../../../src/lib/events/feed-coverage-store', () => ({
  compactFeedCoverage: mocks.compactFeedCoverage,
  deleteAllFeedCoverageAfterEventCompaction: vi.fn(() => {
    throw new Error('global coverage delete must not run');
  }),
}));

vi.mock('../../../src/lib/storage/repositories/feed-scan-hints-store', () => ({
  deleteAllFeedScanHintsWithLedger: vi.fn(() => {
    throw new Error('global scan hint delete must not run');
  }),
}));

vi.mock(
  '../../../src/lib/storage/sqlite-opfs/cache-compaction-sqlite',
  () => ({
    sqliteDeleteEventCacheRows: mocks.sqliteDeleteEventCacheRows,
    sqliteDeleteDirectCacheRows: mocks.sqliteDeleteDirectCacheRows,
  }),
);

describe('compaction deletion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prunes event rows without global coverage or scan-hint deletion', async () => {
    const { deletePrunedEvents } = await import(
      '../../../src/lib/cache/compaction-delete'
    );
    const rows = [record('a', 10), record('b', 20)];
    await expect(deletePrunedEvents(rows)).resolves.toMatchObject({
      prunedEvents: 2,
      prunedBytes: 30,
    });
    expect(mocks.sqliteDeleteEventCacheRows).toHaveBeenCalledWith(rows);
    expect(mocks.compactFeedCoverage).toHaveBeenCalledOnce();
  });
});

function record(resourceId: string, cacheBytes: number): CacheLedgerRecord {
  return {
    id: `event:${resourceId}`,
    ownerKind: 'event',
    resourceKind: 'nostr-event',
    resourceId,
    score: 1,
    createdAt: 1,
    protected: false,
    cacheBytes,
    updatedAt: 1,
  };
}
