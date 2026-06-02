import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { describe, expect, test } from 'vitest';
import {
  executeSql,
  querySql,
  runBatch,
  type SqliteDatabase,
  type SqliteModule,
} from '../../../src/lib/storage/sqlite-opfs/database';
import { openSqliteDatabase } from '../../../src/lib/storage/sqlite-opfs/open-database';

const memoryRequest = {
  databaseName: 'unit.sqlite3',
  allowTransient: true,
  forceMemory: true,
};

describe('SQLite OPFS database helpers', () => {
  test('execute real SQL through official SQLite WASM memory fallback', async () => {
    const sqlite3 = (await sqlite3InitModule()) as unknown as SqliteModule;
    const opened = await openSqliteDatabase(sqlite3, memoryRequest);

    try {
      expect(opened.diagnostics.mode).toBe('temporary-memory');
      executeSql(
        opened.db,
        'CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL) STRICT',
      );
      expect(
        executeSql(opened.db, 'INSERT INTO notes (id, body) VALUES (?, ?)', [
          1,
          'hello',
        ]),
      ).toBe(1);
      expect(
        querySql(opened.db, 'SELECT id, body FROM notes WHERE id = ?', [1], 10),
      ).toEqual([{ id: 1, body: 'hello' }]);
    } finally {
      opened.db.close();
    }
  });

  test('rolls back failed batches atomically', async () => {
    const sqlite3 = (await sqlite3InitModule()) as unknown as SqliteModule;
    const opened = await openSqliteDatabase(sqlite3, memoryRequest);

    try {
      executeSql(
        opened.db,
        'CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL) STRICT',
      );
      expect(() =>
        runBatch(opened.db, [
          {
            statement: 'INSERT INTO notes (id, body) VALUES (?, ?)',
            params: [1, 'first'],
          },
          {
            statement: 'INSERT INTO notes (id, body) VALUES (?, ?)',
            params: [1, 'duplicate'],
          },
        ]),
      ).toThrow();
      expect(
        querySql(opened.db, 'SELECT id FROM notes', undefined, 10),
      ).toEqual([]);
    } finally {
      opened.db.close();
    }
  });

  test('prefers SAH pool OPFS before memory', async () => {
    const db = fakeDb();
    const sqlite: SqliteModule = {
      oo1: { DB: sqliteCtor(db) },
      installOpfsSAHPoolVfs: async () => ({ OpfsSAHPoolDb: sqliteCtor(db) }),
    };
    const opened = await openSqliteDatabase(sqlite, {
      databaseName: '/lkjstr/main.sqlite3',
      allowTransient: true,
    });
    expect(opened.diagnostics.mode).toBe('persistent-opfs');
    expect(opened.diagnostics.vfsName).toBe('opfs-sahpool');
  });

  test('reports explicit memory fallback warnings', async () => {
    const db = fakeDb();
    const sqlite: SqliteModule = {
      oo1: { DB: sqliteCtor(db), OpfsDb: sqliteCtorThatThrows() },
      installOpfsSAHPoolVfs: async () => {
        throw new Error('blocked');
      },
    };
    const opened = await openSqliteDatabase(sqlite, {
      databaseName: '/lkjstr/main.sqlite3',
      allowTransient: true,
    });
    expect(opened.diagnostics.mode).toBe('temporary-memory');
    expect(opened.diagnostics.warnings?.join(' ')).toContain('blocked');
  });
});

function fakeDb(): SqliteDatabase {
  return { exec: () => undefined, changes: () => 0, close: () => undefined };
}

function sqliteCtor<T>(db: SqliteDatabase): new () => T {
  return function fakeSqliteConstructor() {
    return db as T;
  } as unknown as new () => T;
}

function sqliteCtorThatThrows<T>(): new () => T {
  return function fakeSqliteConstructor() {
    throw new Error('opfs failed');
  } as unknown as new () => T;
}
