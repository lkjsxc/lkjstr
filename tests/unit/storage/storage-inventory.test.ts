import { describe, expect, it } from 'vitest';
import { deadlineResult } from '../../../src/lib/storage/indexed-db-inventory-rows';
import { classifyIndexedDbStore } from '../../../src/lib/storage/storage-inventory-classify';
import {
  knownStorageTables,
  storageGroup,
  storageInventory,
} from '../../../src/lib/storage/storage-inventory';
import { browserDb } from '../../../src/lib/storage/browser-db';

describe('storage inventory', () => {
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

  it('classifies every current Dexie table explicitly', () => {
    const known = new Set<string>(knownStorageTables);
    for (const table of browserDb().tables) {
      expect(known.has(table.name)).toBe(true);
      expect(storageGroup(table.name)).not.toBe('unknown');
    }
  });

  it('reports residual browser overhead when indexeddb is unavailable', async () => {
    const rows = await storageInventory(128);
    expect(rows).toContainEqual(
      expect.objectContaining({
        table: 'IndexedDB',
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
        rowCount: null,
        estimatedBytes: 128,
        status: 'exact',
      }),
    );
  });

  it('detects current, legacy, and unknown stores', () => {
    expect(classifyIndexedDbStore('lkjstr', 'events')).toMatchObject({
      group: 'prunable-cache',
      ownership: 'current-known-store',
    });
    expect(
      classifyIndexedDbStore('lkjstr', 'passkeyAccountSecrets'),
    ).toMatchObject({
      group: 'unknown',
      ownership: 'legacy-protected',
      recoverable: false,
    });
    expect(classifyIndexedDbStore('lkjstr', 'futureTable')).toMatchObject({
      group: 'unknown',
      ownership: 'unknown-unowned',
    });
  });

  it('marks deadline scans as partial instead of exact', () => {
    expect(deadlineResult(3, 42)).toMatchObject({
      rowCount: 3,
      status: 'partial',
      estimatedBytes: 42,
    });
    expect(deadlineResult(0, 0)).toMatchObject({
      rowCount: null,
      status: 'timeout',
      estimatedBytes: 0,
    });
  });

  it('keeps overhead out when browser usage is unknown', async () => {
    const rows = await storageInventory(null);
    expect(rows.some((row) => row.group === 'overhead')).toBe(false);
  });
});
