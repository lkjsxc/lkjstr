import { classifyIndexedDbStore } from './storage-inventory-classify';
import type {
  StorageInventoryOptions,
  StorageInventoryRow,
} from './storage-inventory-types';

export function deadlineResult(rowCount: number, estimatedBytes: number) {
  return {
    rowCount: rowCount === 0 ? null : rowCount,
    estimatedBytes,
    status: rowCount === 0 ? 'timeout' : 'partial',
    reason: 'store scan deadline reached',
  } as const;
}

export function indexedDbUnavailableRow(): StorageInventoryRow {
  return databaseRow('IndexedDB', 'unavailable', 'IndexedDB unavailable');
}

export function databaseListUnsupportedRow(): StorageInventoryRow {
  return databaseRow(
    'IndexedDB database enumeration',
    'unsupported',
    'indexedDB.databases() unsupported',
  );
}

export function databaseDeadlineRow(database: string): StorageInventoryRow {
  return databaseRow(database, 'timeout', 'inventory deadline reached');
}

export function emptyDatabaseRow(
  database: string,
  startedAt: number,
  opts: Required<StorageInventoryOptions>,
): StorageInventoryRow {
  return {
    ...databaseRow(database, 'exact'),
    scanDurationMs: opts.now() - startedAt,
  };
}

export function databaseUnavailableRow(
  database: string,
  startedAt: number,
  opts: Required<StorageInventoryOptions>,
  error: unknown,
): StorageInventoryRow {
  return {
    ...databaseRow(
      database,
      'unavailable',
      error instanceof Error ? error.message : 'database open failed',
    ),
    scanDurationMs: opts.now() - startedAt,
  };
}

export function storeUnavailableRow(
  table: string,
  startedAt: number,
  opts: Required<StorageInventoryOptions>,
  error: unknown,
): StorageInventoryRow {
  return {
    table,
    database: 'lkjstr',
    objectStore: table,
    kind: 'indexeddb-object-store',
    ...classifyIndexedDbStore('lkjstr', table),
    rowCount: null,
    estimatedBytes: 0,
    status: 'unavailable',
    scanDurationMs: opts.now() - startedAt,
    reason: error instanceof Error ? error.message : 'store scan failed',
  };
}

function databaseRow(
  table: string,
  status: StorageInventoryRow['status'],
  reason?: string,
): StorageInventoryRow {
  return {
    table,
    database: table,
    kind: 'indexeddb-database',
    ownership: 'unknown-unowned',
    dataClass: 'unknown-legacy-or-unowned-storage',
    group: 'unknown',
    rowCount: null,
    estimatedBytes: 0,
    status,
    reason,
    recoverable: false,
  };
}
