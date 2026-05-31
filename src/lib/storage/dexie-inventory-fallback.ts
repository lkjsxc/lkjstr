import { encodedJsonBytes } from '../cache/cache-byte-size';
import { browserDb } from './browser-db';
import {
  databaseListUnsupportedRow,
  storeUnavailableRow,
} from './indexed-db-inventory-rows';
import { classifyIndexedDbStore } from './storage-inventory-classify';
import type {
  StorageInventoryOptions,
  StorageInventoryRow,
} from './storage-inventory-types';

export async function dexieManifestFallback(
  opts: Required<StorageInventoryOptions>,
  deadlineAt: number,
): Promise<StorageInventoryRow[]> {
  const rows = await Promise.all(
    browserDb().tables.map((table) => scanDexieTable(table, opts, deadlineAt)),
  );
  return [databaseListUnsupportedRow(), ...rows];
}

async function scanDexieTable(
  table: {
    readonly name: string;
    each: (visit: (row: unknown) => false | void) => Promise<void>;
  },
  opts: Required<StorageInventoryOptions>,
  deadlineAt: number,
): Promise<StorageInventoryRow> {
  const startedAt = opts.now();
  const classification = classifyIndexedDbStore('lkjstr', table.name);
  let estimatedBytes = 0;
  let rowCount = 0;
  try {
    await table.each((row) => {
      if (opts.now() >= deadlineAt) return false;
      rowCount += 1;
      estimatedBytes += encodedJsonBytes(row);
    });
    const timedOut = opts.now() >= deadlineAt;
    return {
      table: table.name,
      database: 'lkjstr',
      objectStore: table.name,
      kind: 'indexeddb-object-store',
      ...classification,
      rowCount: timedOut ? null : rowCount,
      estimatedBytes,
      status: timedOut ? 'partial' : 'exact',
      scanDurationMs: opts.now() - startedAt,
      reason: timedOut ? 'inventory deadline reached' : classification.reason,
    };
  } catch (error) {
    return storeUnavailableRow(table.name, startedAt, opts, error);
  }
}
