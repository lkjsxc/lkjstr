import { describe, expect, test } from 'vitest';
import { createSqliteWorkerCore } from '../../../src/lib/storage/sqlite-opfs/worker-core';
import type {
  SqliteDatabase,
  SqliteModule,
} from '../../../src/lib/storage/sqlite-opfs/database';
import type {
  StorageRequest,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

describe('SQLite OPFS worker busy mapping', () => {
  test('maps SAH owner collisions to busy without memory fallback', async () => {
    const responses: StorageResponse[] = [];
    let installCount = 0;
    const sqlite: SqliteModule = {
      oo1: { DB: sqliteCtor(fakeDb()) },
      installOpfsSAHPoolVfs: async () => {
        installCount += 1;
        throw noModificationError();
      },
    };
    const core = createSqliteWorkerCore({
      initSqlite: async () => sqlite,
      estimateStorage: async () => ({}),
      post: (response) => responses.push(response),
    });

    await core.handle(
      request('busy-open', {
        kind: 'open',
        database: { databaseName: 'test.sqlite3', allowTransient: true },
      }),
    );

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      outcome: 'busy',
      diagnostics: { ownerReason: 'sahpool-lock-conflict' },
    });
    expect(installCount).toBe(1);
  });
});

function request(id: string, op: StorageRequest['op']): StorageRequest {
  return { requestId: id, deadlineMs: 5_000, op };
}

function fakeDb(): SqliteDatabase {
  return { exec: () => undefined, changes: () => 0, close: () => undefined };
}

function noModificationError(): Error {
  const error = new Error('createSyncAccessHandle found another Access Handle');
  error.name = 'NoModificationAllowedError';
  return error;
}

function sqliteCtor<T>(db: SqliteDatabase): new () => T {
  return function fakeSqliteConstructor() {
    return db as T;
  } as unknown as new () => T;
}
