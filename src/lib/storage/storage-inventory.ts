import { nonIndexedStorageInventory } from './non-indexed-storage-inventory';
import { oldIndexedDbDiagnostics } from './old-indexed-db-diagnostics';
import { storageManifestGroup } from './schema/table-groups';
import { isStorageTableName, storageTableNames } from './schema/table-names';
import { readSqlitePhysicalInventory } from './sqlite-opfs/physical-inventory-repository';
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
  const [sqlite, oldIndexedRows, nonIndexedRows] = await Promise.all([
    readSqlitePhysicalInventory(options.totalDeadlineMs),
    oldIndexedDbDiagnostics(),
    nonIndexedStorageInventory(),
  ]);
  const rows = [...sqlite.rows, ...oldIndexedRows, ...nonIndexedRows];
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
