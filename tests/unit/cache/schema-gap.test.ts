import { afterEach, describe, expect, it, vi } from 'vitest';

describe('cache schema gaps', () => {
  afterEach(() => vi.resetModules());

  it('falls back when ledger byte scans hit a missing object store', async () => {
    mockStorage({
      cacheLedger: {
        each: async () => {
          throw notFoundError();
        },
        where: () => ({
          equals: () => ({
            each: async () => {
              throw notFoundError();
            },
          }),
        }),
      },
    });
    const stats = await import('../../../src/lib/cache/cache-ledger-stats');
    await expect(stats.estimatedLedgerBytes()).resolves.toBe(0);
    await expect(stats.estimatedPrunableCacheBytes()).resolves.toBe(0);
    await expect(stats.estimatedEventCacheBytes()).resolves.toBe(0);
    await expect(stats.estimatedLedgerBytesByOwner()).resolves.toEqual([]);
  });

  it('keeps ledger health and repair diagnostic-only on schema gaps', async () => {
    mockStorage({
      cacheLedger: {
        each: async () => {
          throw notFoundError();
        },
      },
    });
    const repair = await import('../../../src/lib/cache/cache-ledger-repair');
    await expect(repair.cacheLedgerHealth()).resolves.toEqual({
      orphanLedgerRows: 0,
      missingLedgerRows: 0,
    });
    await expect(repair.repairCacheLedger()).resolves.toMatchObject({
      orphanLedgerRowsDeleted: 0,
      missingLedgerRowsInserted: 0,
      staleLedgerRowsUpdated: 0,
      skippedProtectedRows: 0,
    });
  });

  it('returns no prune candidates when cacheLedger cannot be scanned', async () => {
    mockStorage({
      cacheLedger: {
        orderBy: () => ({
          each: async () => {
            throw notFoundError();
          },
        }),
      },
    });
    const selection = await import('../../../src/lib/cache/compaction-select');
    await expect(
      selection.lowestScorePruneSelection(10, new Set()),
    ).resolves.toEqual({
      selectedRows: [],
      scannedRows: 0,
      skippedDurablyProtected: 0,
      skippedDynamicallyProtected: 0,
      selectedBytes: 0,
    });
  });
});

function mockStorage(db: unknown): void {
  vi.doMock('../../../src/lib/storage/browser-db', () => ({
    browserDb: () => db,
  }));
  vi.doMock('../../../src/lib/storage/safe-storage', () => ({
    indexedDbAvailable: () => true,
    boundedStorageRead: async <T>(read: () => Promise<T>, fallback: T) => {
      try {
        return await read();
      } catch {
        return fallback;
      }
    },
  }));
}

function notFoundError(): Error {
  const error = new Error(
    "Failed to execute 'objectStore' on 'IDBTransaction'",
  );
  error.name = 'NotFoundError';
  return error;
}
