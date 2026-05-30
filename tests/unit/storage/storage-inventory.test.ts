import { describe, expect, it } from 'vitest';
import {
  storageGroup,
  storageInventory,
} from '../../../src/lib/storage/storage-inventory';

describe('storage inventory', () => {
  it('classifies storage tables by ownership group', () => {
    expect(storageGroup('events')).toBe('event-cache');
    expect(storageGroup('eventRelays')).toBe('event-cache');
    expect(storageGroup('feedCoverage')).toBe('derived-cache');
    expect(storageGroup('relayInformation')).toBe('diagnostics');
    expect(storageGroup('localAccountSecrets')).toBe('protected');
    expect(storageGroup('futureTable')).toBe('unknown');
  });

  it('reports browser overhead when indexeddb is unavailable', async () => {
    await expect(storageInventory(128)).resolves.toEqual([
      {
        table: 'browser-overhead-or-unknown',
        group: 'overhead',
        rowCount: null,
        estimatedBytes: 128,
      },
    ]);
  });

  it('omits overhead when browser usage is unknown', async () => {
    await expect(storageInventory(null)).resolves.toEqual([]);
  });
});
