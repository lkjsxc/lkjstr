import { describe, expect, it } from 'vitest';
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

  it('reports browser overhead when indexeddb is unavailable', async () => {
    const rows = await storageInventory(128);
    expect(rows).toContainEqual({
      table: 'IndexedDB',
      group: 'unknown',
      rowCount: null,
      estimatedBytes: 0,
      status: 'unavailable',
    });
    expect(rows).toContainEqual({
      table: 'browser-overhead-or-unknown',
      group: 'overhead',
      rowCount: null,
      estimatedBytes: 128,
      status: 'exact',
    });
  });

  it('omits overhead when browser usage is unknown', async () => {
    const rows = await storageInventory(null);
    expect(rows.some((row) => row.group === 'overhead')).toBe(false);
  });
});
