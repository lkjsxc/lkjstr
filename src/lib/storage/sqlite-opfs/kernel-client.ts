import { createSqliteOpfsClient, type SqliteOpfsClient } from './client';
import type { StorageOp, StorageResponse } from './types';

export type SqliteStorageClientFactory = () => SqliteOpfsClient;
export type SqliteStorageSendOptions = {
  readonly deadlineMs?: number;
  readonly signal?: AbortSignal;
};

const databaseName = '/lkjstr/main.sqlite3';
let client: SqliteOpfsClient | undefined;
let openPromise: Promise<StorageResponse> | undefined;
const schemaPromises = new Map<string, Promise<StorageResponse>>();

export async function sendSqliteStorage(
  op: StorageOp,
  options: SqliteStorageSendOptions = {},
): Promise<StorageResponse> {
  const storage = sqliteStorageClient();
  const opened = await openSqliteStorage(storage);
  if (opened.outcome !== 'ok') return opened;
  return storage.send(op, options);
}

export async function applySqliteSchema(
  schemaHash: string,
  statements: readonly string[],
): Promise<StorageResponse> {
  const existing = schemaPromises.get(schemaHash);
  if (existing) return existing;
  const next = sendSqliteStorage(
    { kind: 'apply-schema', schemaHash, statements },
    { deadlineMs: 5_000 },
  );
  schemaPromises.set(schemaHash, next);
  return next;
}

export function sqliteStorageClient(): SqliteOpfsClient {
  client ??= createSqliteOpfsClient({ requestPrefix: 'sqlite-storage' });
  return client;
}

export function sqliteStorageUnavailable(): StorageResponse {
  return {
    requestId: 'sqlite-storage-unavailable',
    outcome: 'unavailable',
    rows: [],
    rowsAffected: 0,
    diagnostics: { message: 'Worker support unavailable' },
  };
}

function openSqliteStorage(
  storage: SqliteOpfsClient,
): Promise<StorageResponse> {
  if (typeof Worker === 'undefined')
    return Promise.resolve(sqliteStorageUnavailable());
  openPromise ??= storage.send(
    {
      kind: 'open',
      database: {
        databaseName,
        preferredVfs: 'opfs-sahpool',
        allowSahpool: true,
        allowOpfs: true,
        allowTransient: true,
        workerKind: 'dedicated',
      },
    },
    { deadlineMs: 5_000 },
  );
  return openPromise;
}
