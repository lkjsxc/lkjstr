import { indexedDbInventory } from './indexed-db-inventory';
import { indexedDbAvailable } from './safe-storage';
import { nonIndexedStorageInventory } from './non-indexed-storage-inventory';
import { storageManifestGroup } from './schema/table-groups';
import { isStorageTableName, storageTableNames } from './schema/table-names';
import type {
  StorageGroup,
  StorageInventoryOptions,
  StorageInventoryRow,
} from './storage-inventory-types';

export type {
  StorageGroup,
  StorageInventoryDataClass,
  StorageInventoryKind,
  StorageInventoryOptions,
  StorageInventoryOwnership,
  StorageInventoryRow,
  StorageInventoryStatus,
} from './storage-inventory-types';

export const knownStorageTables = storageTableNames;

export async function storageInventory(
  browserUsageBytes: number | null,
  options: StorageInventoryOptions = {},
): Promise<StorageInventoryRow[]> {
  const indexedRows = indexedDbAvailable()
    ? await indexedDbInventory(options)
    : [indexedDbUnavailableRow()];
  const nonIndexedRows = await nonIndexedStorageInventory();
  const rows = [...indexedRows, ...nonIndexedRows];
  const knownBytes = rows
    .filter((row) => row.group !== 'overhead')
    .reduce((sum, row) => sum + row.estimatedBytes, 0);
  return [...rows, ...overheadRows(browserUsageBytes, knownBytes)];
}

export function storageGroup(tableName: string): StorageGroup {
  return isStorageTableName(tableName)
    ? storageManifestGroup(tableName)
    : 'unknown';
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
      table: 'residual-browser-overhead',
      kind: 'residual-overhead',
      ownership: 'residual-overhead',
      dataClass: 'residual-browser-overhead',
      group: 'overhead',
      rowCount: null,
      estimatedBytes,
      status: 'exact',
      recoverable: false,
    },
  ];
}

function indexedDbUnavailableRow(): StorageInventoryRow {
  return {
    table: 'IndexedDB',
    kind: 'indexeddb-database',
    ownership: 'unknown-unowned',
    dataClass: 'unknown-legacy-or-unowned-storage',
    group: 'unknown',
    rowCount: null,
    estimatedBytes: 0,
    status: 'unavailable',
    recoverable: false,
  };
}
