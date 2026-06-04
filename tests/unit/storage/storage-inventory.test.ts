import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  knownStorageTables,
  storageGroup,
  storageInventory,
} from '../../../src/lib/storage/storage-inventory';

describe('storage inventory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('classifies storage tables by ownership group', () => {
    expect(storageGroup('events')).toBe('prunable-cache');
    expect(storageGroup('eventRelays')).toBe('prunable-cache');
    expect(storageGroup('notifications')).toBe('prunable-cache');
    expect(storageGroup('cacheLedger')).toBe('ledger');
    expect(storageGroup('feedCoverage')).toBe('derived-page-cache');
    expect(storageGroup('relayInformation')).toBe('diagnostics');
    expect(storageGroup('relayRouteBlocks')).toBe('protected-safety');
    expect(storageGroup('cacheMeta')).toBe('metadata');
    expect(storageGroup('localAccountSecrets')).toBe('protected');
    expect(storageGroup('futureTable')).toBe('unknown');
  });

  it('classifies every manifest table explicitly', () => {
    for (const table of knownStorageTables)
      expect(storageGroup(table)).not.toBe('unknown');
  });

  it('reports residual overhead when SQLite is unavailable', async () => {
    const rows = await storageInventory(128);
    expect(rows).toContainEqual(
      expect.objectContaining({
        table: 'SQLite',
        group: 'unknown',
        rowCount: null,
        estimatedBytes: 0,
        status: 'unavailable',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        table: 'residual-browser-overhead',
        group: 'overhead',
        estimatedBytes: 128,
        status: 'exact',
      }),
    );
  });

  it('lists old IndexedDB databases without scanning object-store rows', async () => {
    vi.stubGlobal('indexedDB', {
      open: vi.fn(),
      databases: async () => [{ name: 'lkjstr' }, { name: 'foreign' }],
    });

    const rows = await storageInventory(null);
    expect(rows).toContainEqual(
      expect.objectContaining({
        table: 'old-indexeddb:lkjstr',
        database: 'lkjstr',
        status: 'estimated',
        reason: 'old IndexedDB database presence; row scan skipped',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        table: 'old-indexeddb:foreign',
        ownership: 'unknown-unowned',
      }),
    );
  });

  it('maps SQLite physical inventory rows to storage groups', async () => {
    vi.doMock('../../../src/lib/storage/sqlite-opfs/kernel-client', () => ({
      sendSqliteStorage: async () => ({
        outcome: 'ok',
        rows: [
          row('events', 3, 768),
          row('local_account_secrets', 1, 256),
          row('feed_scan_density_models', 2, 512),
        ],
        diagnostics: { mode: 'persistent-opfs' },
      }),
    }));
    const { readSqlitePhysicalInventory } =
      await import('../../../src/lib/storage/sqlite-opfs/physical-inventory-repository');

    const result = await readSqlitePhysicalInventory();
    expect(result.mode).toBe('persistent-opfs');
    expect(result.rows).toContainEqual(
      expect.objectContaining({ table: 'events', group: 'prunable-cache' }),
    );
    expect(result.rows).toContainEqual(
      expect.objectContaining({
        table: 'local_account_secrets',
        group: 'protected',
      }),
    );
    expect(result.rows).toContainEqual(
      expect.objectContaining({
        table: 'feed_scan_density_models',
        group: 'derived-page-cache',
      }),
    );
  });

  it('keeps overhead out when browser usage is unknown', async () => {
    const rows = await storageInventory(null);
    expect(rows.some((row) => row.group === 'overhead')).toBe(false);
  });
});

function row(table: string, row_count: number, estimated_bytes: number) {
  return { table, row_count, estimated_bytes, status: 'estimated' };
}
