import { afterEach, describe, expect, it, vi } from 'vitest';
import { ledger } from '../storage/sqlite-opfs-test-helpers';

describe('cache schema gaps', () => {
  afterEach(() => vi.resetModules());

  it('falls back when ledger byte reads are unavailable', async () => {
    vi.doMock(
      '../../../src/lib/storage/sqlite-opfs/cache-ledger-sqlite',
      () => ({
        sqliteReadCacheLedgerRows: async () => undefined,
      }),
    );
    const stats = await import('../../../src/lib/cache/cache-ledger-stats');
    await expect(stats.estimatedLedgerBytes()).resolves.toBe(0);
    await expect(stats.estimatedPrunableCacheBytes()).resolves.toBe(0);
    await expect(stats.estimatedEventCacheBytes()).resolves.toBe(0);
    await expect(stats.estimatedLedgerBytesByOwner()).resolves.toEqual([]);
  });

  it('keeps ledger health and repair diagnostic-only on unavailable storage', async () => {
    vi.doMock(
      '../../../src/lib/storage/sqlite-opfs/cache-ledger-repair-ledger-sqlite',
      () => ({
        visitSqliteLedgerRows: async () => undefined,
        readSqliteLedgerRecord: async () => undefined,
        flushSqliteLedgerRows: async () => undefined,
        deleteSqliteLedgerIds: async () => undefined,
        executeSqliteStorage: async () => 0,
      }),
    );
    vi.doMock(
      '../../../src/lib/storage/sqlite-opfs/cache-ledger-repair-rows-sqlite',
      () => ({
        collectSqliteRepairRows: async () => ({
          scannedResources: 0,
          unavailableTargets: 1,
        }),
      }),
    );
    const repair = await import('../../../src/lib/cache/cache-ledger-repair');
    await expect(repair.cacheLedgerHealth()).resolves.toEqual({
      orphanLedgerRows: 0,
      missingLedgerRows: 0,
      unavailableTargets: 1,
    });
    await expect(repair.repairCacheLedger()).resolves.toMatchObject({
      orphanLedgerRowsDeleted: 0,
      missingLedgerRowsInserted: 0,
      staleLedgerRowsUpdated: 0,
      skippedProtectedRows: 0,
    });
  });

  it('awaits repair visitors from SQLite repair rows', async () => {
    vi.doMock(
      '../../../src/lib/storage/sqlite-opfs/cache-ledger-repair-rows-sqlite',
      () => ({
        collectSqliteRepairRows: async (
          visit: (row: unknown) => Promise<void>,
        ) => {
          await visit(ledger('n1'));
          return { scannedResources: 1, unavailableTargets: 0 };
        },
      }),
    );
    const rows: string[] = [];
    const repairRows =
      await import('../../../src/lib/cache/cache-ledger-repair-rows');
    await repairRows.collectRepairRows(async (record) => {
      await Promise.resolve();
      rows.push(record.id);
    });
    expect(rows).toEqual(['n1']);
  });

  it('returns no prune candidates when ledger rows cannot be read', async () => {
    vi.doMock(
      '../../../src/lib/storage/sqlite-opfs/cache-ledger-sqlite',
      () => ({
        sqliteReadCacheLedgerRows: async () => undefined,
      }),
    );
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
