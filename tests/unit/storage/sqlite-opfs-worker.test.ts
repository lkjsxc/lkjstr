import { describe, expect, test } from 'vitest';
import { createSqliteWorkerCore } from '../../../src/lib/storage/sqlite-opfs/worker-core';
import type {
  SqlParams,
  SqlRow,
  StorageRequest,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';
import type {
  SqliteDatabase,
  SqliteModule,
} from '../../../src/lib/storage/sqlite-opfs/database';

describe('SQLite OPFS worker core', () => {
  test('opens, applies schema, executes, queries, estimates, and closes', async () => {
    const responses: StorageResponse[] = [];
    const rows: SqlRow[] = [];
    let closed = false;
    const db: SqliteDatabase = {
      filename: '/test.sqlite3',
      exec: (input) => {
        if (typeof input === 'string') return undefined;
        if (input.sql.startsWith('INSERT')) rows.push(rowFrom(input.bind));
        if (input.returnValue === 'resultRows') return rows;
        return undefined;
      },
      changes: () => 1,
      close: () => {
        closed = true;
      },
    };
    const sqlite: SqliteModule = {
      oo1: {
        DB: sqliteCtor(db),
        OpfsDb: sqliteCtor(db),
      },
    };
    const core = createSqliteWorkerCore({
      initSqlite: async () => sqlite,
      estimateStorage: async () => ({
        storageUsageBytes: 12,
        storageQuotaBytes: 34,
      }),
      post: (response) => responses.push(response),
    });

    await core.handle(
      request('1', {
        kind: 'open',
        database: { databaseName: 'test.sqlite3' },
      }),
    );
    await core.handle(
      request('2', {
        kind: 'apply-schema',
        statements: ['PRAGMA foreign_keys = ON;'],
      }),
    );
    await core.handle(
      request('3', {
        kind: 'execute',
        statement: 'INSERT',
        params: [7, 'seven'],
      }),
    );
    await core.handle(
      request('4', { kind: 'query', statement: 'SELECT', rowLimit: 10 }),
    );
    await core.handle(request('5', { kind: 'estimate-storage' }));
    await core.handle(request('6', { kind: 'close' }));
    await core.handle(request('7', { kind: 'close' }));

    expect(responses.map((response) => response.outcome)).toEqual([
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
    ]);
    expect(responses[0]?.diagnostics.vfs).toBe('opfs');
    expect(responses[3]?.rows).toEqual([{ id: 7, label: 'seven' }]);
    expect(responses[4]?.diagnostics.storageQuotaBytes).toBe(34);
    expect(closed).toBe(true);
  });
});

function request(id: string, op: StorageRequest['op']): StorageRequest {
  return { requestId: id, deadlineMs: 5_000, op };
}

function rowFrom(params: SqlParams | undefined): SqlRow {
  const values = Array.isArray(params) ? params : [];
  return { id: Number(values[0] ?? 0), label: String(values[1] ?? '') };
}

function sqliteCtor<T>(
  db: SqliteDatabase,
): new (...args: readonly unknown[]) => T {
  return function fakeSqliteConstructor() {
    return db as T;
  } as unknown as new (...args: readonly unknown[]) => T;
}
