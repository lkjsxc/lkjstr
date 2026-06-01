import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { describe, expect, test } from 'vitest';
import {
  executeSql,
  openSqliteDatabase,
  querySql,
  runBatch,
  type SqliteModule,
} from '../../../src/lib/storage/sqlite-opfs/database';

describe('SQLite OPFS database helpers', () => {
  test('execute real SQL through official SQLite WASM memory fallback', async () => {
    const sqlite3 = (await sqlite3InitModule()) as unknown as SqliteModule;
    const opened = await openSqliteDatabase(sqlite3, {
      databaseName: 'unit.sqlite3',
      allowTransient: true,
    });

    try {
      expect(opened.diagnostics.vfs).toBe('memory');
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

      const rows = querySql(
        opened.db,
        'SELECT id, body FROM notes WHERE id = ?',
        [1],
        10,
      );
      expect(rows).toEqual([{ id: 1, body: 'hello' }]);
    } finally {
      opened.db.close();
    }
  });

  test('rolls back failed batches atomically', async () => {
    const sqlite3 = (await sqlite3InitModule()) as unknown as SqliteModule;
    const opened = await openSqliteDatabase(sqlite3, {
      databaseName: 'rollback.sqlite3',
      allowTransient: true,
    });

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
});
