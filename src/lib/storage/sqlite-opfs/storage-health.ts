import { createSqliteOpfsClient, type SqliteOpfsClient } from './client';
import type { StorageHealth, StorageResponse } from './types';

export type SqliteStorageHealthStatus =
  | {
      readonly status: 'available';
      readonly health: StorageHealth;
      readonly diagnostics: StorageResponse['diagnostics'];
    }
  | { readonly status: 'unavailable'; readonly message: string };

export type ReadSqliteStorageHealthOptions = {
  readonly createClient?: () => SqliteOpfsClient;
};

const databaseName = '/lkjstr/main.sqlite3';
let client: SqliteOpfsClient | undefined;
let openPromise: Promise<StorageResponse> | undefined;

export async function readSqliteStorageHealth(
  options: ReadSqliteStorageHealthOptions = {},
): Promise<SqliteStorageHealthStatus> {
  if (typeof Worker === 'undefined' && !options.createClient)
    return { status: 'unavailable', message: 'Worker support unavailable' };
  const storage = options.createClient?.() ?? storageClient();
  const opened = await openStorage(storage, Boolean(options.createClient));
  if (opened.outcome !== 'ok') return unavailable(opened);
  const response = await storage.send(
    { kind: 'get-storage-health' },
    { deadlineMs: 3_000 },
  );
  const health = response.diagnostics.health;
  if (response.outcome !== 'ok' || !health) return unavailable(response);
  return { status: 'available', health, diagnostics: response.diagnostics };
}

function storageClient(): SqliteOpfsClient {
  client ??= createSqliteOpfsClient({ requestPrefix: 'sqlite-health' });
  return client;
}

function openStorage(
  storage: SqliteOpfsClient,
  freshClient: boolean,
): Promise<StorageResponse> {
  if (freshClient) return sendOpen(storage);
  openPromise ??= sendOpen(storage);
  return openPromise;
}

function sendOpen(storage: SqliteOpfsClient): Promise<StorageResponse> {
  return storage.send(
    {
      kind: 'open',
      database: {
        databaseName,
        allowSahpool: true,
        allowOpfs: true,
        allowTransient: true,
        workerKind: 'dedicated',
      },
    },
    { deadlineMs: 5_000 },
  );
}

function unavailable(response: StorageResponse): SqliteStorageHealthStatus {
  return {
    status: 'unavailable',
    message:
      response.diagnostics.message ??
      `SQLite storage response outcome: ${response.outcome}`,
  };
}
