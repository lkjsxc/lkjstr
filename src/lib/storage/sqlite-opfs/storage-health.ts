import type { SqliteOpfsClient } from './client';
import { sendSqliteStorage } from './kernel-client';
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

export async function readSqliteStorageHealth(
  options: ReadSqliteStorageHealthOptions = {},
): Promise<SqliteStorageHealthStatus> {
  const response = options.createClient
    ? await readWithFreshClient(options.createClient())
    : await sendSqliteStorage(
        { kind: 'get-storage-health' },
        { deadlineMs: 3_000 },
      );
  const health = response.diagnostics.health;
  if (response.outcome !== 'ok' || !health) return unavailable(response);
  return { status: 'available', health, diagnostics: response.diagnostics };
}

async function readWithFreshClient(
  storage: SqliteOpfsClient,
): Promise<StorageResponse> {
  const opened = await storage.send(
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
  if (opened.outcome !== 'ok') return opened;
  return storage.send({ kind: 'get-storage-health' }, { deadlineMs: 3_000 });
}

function unavailable(response: StorageResponse): SqliteStorageHealthStatus {
  return {
    status: 'unavailable',
    message:
      response.diagnostics.message ??
      `SQLite storage response outcome: ${response.outcome}`,
  };
}
