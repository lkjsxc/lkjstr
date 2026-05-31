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

  it('does not delete ledger rows when target stores are unavailable', async () => {
    const bulkDelete = vi.fn();
    mockStorage({
      cacheLedger: {
        toArray: async () => [
          {
            id: 'event:missing-target',
            ownerKind: 'event',
            resourceKind: 'nostr-event',
            resourceId: 'missing-target',
            score: 0,
            createdAt: 1,
            updatedAt: 1,
            cacheBytes: 1,
            protected: false,
          },
        ],
        bulkDelete,
      },
      events: {
        get: async () => {
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
    });
    expect(bulkDelete).not.toHaveBeenCalled();
  });

  it('awaits repair visitors and skips unavailable source tables', async () => {
    mockStorage({
      events: {
        toArray: async () => [
          {
            id: 'a'.repeat(64),
            pubkey: 'b'.repeat(64),
            created_at: 1,
            kind: 1,
            tags: [],
            content: 'hello',
            sig: 'c'.repeat(128),
            receivedAt: 1,
            relayUrls: [],
          },
        ],
      },
      eventRelays: queryRows([]),
      eventTags: queryRows([]),
      notifications: {
        toArray: async () => {
          throw notFoundError();
        },
      },
    });
    const rows: string[] = [];
    const repairRows =
      await import('../../../src/lib/cache/cache-ledger-repair-rows');
    await repairRows.collectRepairRows(async (record) => {
      await Promise.resolve();
      rows.push(record.id);
    });
    expect(rows).toEqual([`event:${'a'.repeat(64)}`]);
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

function queryRows(rows: unknown[]) {
  return {
    where: () => ({
      equals: () => ({
        toArray: async () => rows,
      }),
    }),
  };
}
