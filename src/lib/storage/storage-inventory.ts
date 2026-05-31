import { encodedJsonBytes } from '../cache/cache-byte-size';
import { browserDb } from './browser-db';
import { indexedDbAvailable } from './safe-storage';
import { nonIndexedStorageInventory } from './non-indexed-storage-inventory';
import { storageTableSpecs } from './schema/table-manifest';
import { isStorageTableName, storageTableNames } from './schema/table-names';
import { storageManifestGroup } from './schema/table-groups';
import type { StorageDataClass } from './schema/table-spec';

export type StorageGroup =
  | ReturnType<typeof storageManifestGroup>
  | 'non-indexed'
  | 'overhead'
  | 'unknown';

export type StorageInventoryStatus =
  | 'exact'
  | 'timeout'
  | 'unavailable'
  | 'unsupported';

export type StorageInventoryRow = {
  readonly table: string;
  readonly dataClass?: StorageDataClass | 'non-indexed-browser-storage';
  readonly group: StorageGroup;
  readonly rowCount: number | null;
  readonly estimatedBytes: number;
  readonly status: StorageInventoryStatus;
  readonly scanDurationMs?: number;
  readonly reason?: string;
};

export const knownStorageTables = storageTableNames;

export async function storageInventory(
  browserUsageBytes: number | null,
): Promise<StorageInventoryRow[]> {
  const indexedRows = indexedDbAvailable()
    ? await indexedDbRows()
    : [indexedDbUnavailableRow()];
  const nonIndexedRows = await nonIndexedStorageInventory();
  const rows = [...indexedRows, ...nonIndexedRows];
  const knownBytes = rows.reduce((sum, row) => sum + row.estimatedBytes, 0);
  return [...rows, ...overheadRows(browserUsageBytes, knownBytes)];
}

export function storageGroup(tableName: string): StorageGroup {
  return isStorageTableName(tableName)
    ? storageManifestGroup(tableName)
    : 'unknown';
}

async function indexedDbRows(): Promise<StorageInventoryRow[]> {
  const rows: StorageInventoryRow[] = [];
  for (const table of browserDb().tables) {
    rows.push(await storageTableRow(table));
  }
  return rows;
}

async function storageTableRow(table: {
  readonly name: string;
  each: (callback: (row: unknown) => false | void) => Promise<void>;
}): Promise<StorageInventoryRow> {
  const startedAt = Date.now();
  let estimatedBytes = 0;
  let rowCount = 0;
  let timedOut = false;
  try {
    await table.each((row) => {
      if (Date.now() - startedAt > 1000) {
        timedOut = true;
        return false;
      }
      rowCount += 1;
      estimatedBytes += encodedJsonBytes(row);
    });
    return {
      table: table.name,
      dataClass: storageDataClass(table.name),
      group: storageGroup(table.name),
      rowCount: timedOut ? null : rowCount,
      estimatedBytes,
      status: timedOut ? 'timeout' : 'exact',
      scanDurationMs: Date.now() - startedAt,
      reason: timedOut ? 'table scan deadline reached' : undefined,
    };
  } catch (error) {
    return {
      table: table.name,
      dataClass: storageDataClass(table.name),
      group: storageGroup(table.name),
      rowCount: null,
      estimatedBytes,
      status: 'unavailable',
      scanDurationMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : 'table scan failed',
    };
  }
}

function storageDataClass(tableName: string): StorageDataClass | undefined {
  return storageTableSpecs.find((table) => table.name === tableName)?.dataClass;
}

function overheadRows(
  browserUsageBytes: number | null,
  knownBytes: number,
): StorageInventoryRow[] {
  if (browserUsageBytes === null) return [];
  const estimatedBytes = Math.max(0, browserUsageBytes - knownBytes);
  if (estimatedBytes === 0) return [];
  return [
    {
      table: 'browser-overhead-or-unknown',
      group: 'overhead',
      rowCount: null,
      estimatedBytes,
      status: 'exact',
    },
  ];
}

function indexedDbUnavailableRow(): StorageInventoryRow {
  return {
    table: 'IndexedDB',
    group: 'unknown',
    rowCount: null,
    estimatedBytes: 0,
    status: 'unavailable',
  };
}
