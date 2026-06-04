import type { StorageInventoryRow } from './storage-inventory-types';

type DbInfo = { readonly name?: string; readonly version?: number };
type DbFactoryWithList = IDBFactory & {
  databases?: () => Promise<readonly DbInfo[]>;
};

export async function oldIndexedDbDiagnostics(): Promise<
  StorageInventoryRow[]
> {
  const factory = globalThis.indexedDB as DbFactoryWithList | undefined;
  if (!factory?.open) return [unavailableRow('IndexedDB unavailable')];
  if (!factory.databases) return [unsupportedRow()];
  try {
    const names = (await factory.databases())
      .map((info) => info.name)
      .filter((name): name is string => Boolean(name));
    return names.length === 0 ? [] : names.map(databaseRow);
  } catch (error) {
    return [unavailableRow(errorText(error))];
  }
}

function databaseRow(database: string): StorageInventoryRow {
  return {
    table: `old-indexeddb:${database}`,
    database,
    kind: 'indexeddb-database',
    ownership: database === 'lkjstr' ? 'legacy-protected' : 'unknown-unowned',
    dataClass: 'unknown-legacy-or-unowned-storage',
    group: 'unknown',
    rowCount: null,
    estimatedBytes: 0,
    status: 'estimated',
    reason: 'old IndexedDB database presence; row scan skipped',
    recoverable: false,
  };
}

function unsupportedRow(): StorageInventoryRow {
  return {
    table: 'old-indexeddb:list',
    kind: 'indexeddb-database',
    ownership: 'unknown-unowned',
    dataClass: 'unknown-legacy-or-unowned-storage',
    group: 'unknown',
    rowCount: null,
    estimatedBytes: 0,
    status: 'unsupported',
    reason: 'IndexedDB database listing unsupported',
    recoverable: false,
  };
}

function unavailableRow(reason: string): StorageInventoryRow {
  return {
    ...unsupportedRow(),
    status: 'unavailable',
    reason,
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'database list failed';
}
