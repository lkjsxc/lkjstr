import { encodedJsonBytes } from '../cache/cache-byte-size';
import { dexieManifestFallback } from './dexie-inventory-fallback';
import { classifyIndexedDbStore } from './storage-inventory-classify';
import {
  databaseDeadlineRow,
  databaseUnavailableRow,
  deadlineResult,
  emptyDatabaseRow,
  indexedDbUnavailableRow,
} from './indexed-db-inventory-rows';
import type {
  StorageInventoryOptions,
  StorageInventoryRow,
} from './storage-inventory-types';
import { defaultInventoryOptions } from './storage-inventory-types';

type DbInfo = { readonly name?: string; readonly version?: number };
type DbFactoryWithList = IDBFactory & {
  databases?: () => Promise<readonly DbInfo[]>;
};

export async function indexedDbInventory(
  options: StorageInventoryOptions = {},
): Promise<StorageInventoryRow[]> {
  const opts = { ...defaultInventoryOptions, ...options };
  const deadlineAt = opts.now() + opts.totalDeadlineMs;
  const factory = globalThis.indexedDB as DbFactoryWithList | undefined;
  if (!factory?.open) return [indexedDbUnavailableRow()];
  if (!factory.databases) return dexieManifestFallback(opts, deadlineAt);
  try {
    const infos = await factory.databases();
    const names = infos.map((info) => info.name).filter(isNamed);
    return scanDatabases(names, opts, deadlineAt);
  } catch (error) {
    return [
      {
        ...indexedDbUnavailableRow(),
        reason: error instanceof Error ? error.message : 'database list failed',
      },
    ];
  }
}

async function scanDatabases(
  names: readonly string[],
  opts: Required<StorageInventoryOptions>,
  deadlineAt: number,
): Promise<StorageInventoryRow[]> {
  const rows: StorageInventoryRow[] = [];
  for (const name of names) {
    if (opts.now() >= deadlineAt) {
      rows.push(databaseDeadlineRow(name));
      continue;
    }
    rows.push(...(await scanDatabase(name, opts, deadlineAt)));
  }
  return rows;
}

async function scanDatabase(
  name: string,
  opts: Required<StorageInventoryOptions>,
  deadlineAt: number,
): Promise<StorageInventoryRow[]> {
  const startedAt = opts.now();
  try {
    const db = await openExistingDatabase(name);
    const stores = Array.from(db.objectStoreNames);
    if (stores.length === 0) return [emptyDatabaseRow(name, startedAt, opts)];
    const rows: StorageInventoryRow[] = [];
    for (const store of stores) {
      rows.push(await scanStore(db, store, opts, deadlineAt));
    }
    db.close();
    return rows;
  } catch (error) {
    return [databaseUnavailableRow(name, startedAt, opts, error)];
  }
}

async function scanStore(
  db: IDBDatabase,
  store: string,
  opts: Required<StorageInventoryOptions>,
  totalDeadlineAt: number,
): Promise<StorageInventoryRow> {
  const startedAt = opts.now();
  const deadlineAt = Math.min(
    totalDeadlineAt,
    startedAt + opts.storeDeadlineMs,
  );
  const classification = classifyIndexedDbStore(db.name, store);
  const base = {
    table: store,
    database: db.name,
    objectStore: store,
    kind: 'indexeddb-object-store' as const,
    ...classification,
  };
  try {
    const result = await scanStoreRows(db, store, opts.now, deadlineAt);
    return { ...base, ...result, scanDurationMs: opts.now() - startedAt };
  } catch (error) {
    return {
      ...base,
      rowCount: null,
      estimatedBytes: 0,
      status: 'unavailable',
      scanDurationMs: opts.now() - startedAt,
      reason: error instanceof Error ? error.message : 'store scan failed',
    };
  }
}

function scanStoreRows(
  db: IDBDatabase,
  store: string,
  now: () => number,
  deadlineAt: number,
): Promise<
  Pick<StorageInventoryRow, 'estimatedBytes' | 'reason' | 'rowCount' | 'status'>
> {
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    let estimatedBytes = 0;
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve({ rowCount, estimatedBytes, status: 'exact' });
        return;
      }
      if (now() >= deadlineAt) {
        resolve(deadlineResult(rowCount, estimatedBytes));
        return;
      }
      rowCount += 1;
      estimatedBytes += encodedJsonBytes(cursor.value);
      cursor.continue();
    };
  });
}

function isNamed(name: string | undefined): name is string {
  return Boolean(name);
}

function openExistingDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
