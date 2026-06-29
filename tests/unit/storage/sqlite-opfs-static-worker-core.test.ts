import { describe, expect, test } from 'vitest';

type SqliteOptions = {
  readonly name?: string;
  readonly initialCapacity?: number;
};
type StaticCore = {
  readonly openDatabase: (
    sqlite: unknown,
    database: unknown,
  ) => Promise<{
    readonly diagnostics: { readonly vfsName?: string };
  }>;
  readonly sahpoolInitialCapacitySlots: number;
};

describe('static SQLite worker core open policy', () => {
  test('maps NoModificationAllowedError to owner busy', async () => {
    const { openDatabase } = await staticCore();
    let installCount = 0;
    let memoryCount = 0;
    const sqlite = {
      oo1: {
        DB: function memoryDb() {
          memoryCount += 1;
          return fakeDb();
        },
      },
      installOpfsSAHPoolVfs: async () => {
        installCount += 1;
        throw noModificationError();
      },
    };

    await expect(
      openDatabase(sqlite, {
        databaseName: '/lkjstr/main.sqlite3',
        allowTransient: true,
      }),
    ).rejects.toThrow(/createSyncAccessHandle/);
    expect(installCount).toBe(1);
    expect(memoryCount).toBe(0);
  });

  test('installs SAH pool once with file-slot capacity', async () => {
    const { openDatabase, sahpoolInitialCapacitySlots } = await staticCore();
    const options: SqliteOptions[] = [];
    let installCount = 0;
    const sqlite = {
      oo1: { DB: sqliteCtor(fakeDb()) },
      installOpfsSAHPoolVfs: async (value: SqliteOptions) => {
        installCount += 1;
        options.push(value);
        return { OpfsSAHPoolDb: sqliteCtor(fakeDb()) };
      },
    };

    const first = await openDatabase(sqlite, {
      databaseName: '/lkjstr/main.sqlite3',
      allowTransient: true,
    });
    const second = await openDatabase(sqlite, {
      databaseName: '/lkjstr/other.sqlite3',
      allowTransient: true,
    });

    expect(first.diagnostics.vfsName).toBe('opfs-sahpool');
    expect(second.diagnostics.vfsName).toBe('opfs-sahpool');
    expect(installCount).toBe(1);
    expect(options).toEqual([
      { name: 'lkjstr', initialCapacity: sahpoolInitialCapacitySlots },
    ]);
    expect(sahpoolInitialCapacitySlots).toBe(64);
  });
});

async function staticCore(): Promise<StaticCore> {
  return (await import(
    new URL('../../../static/sqlite-opfs-worker-core.js', import.meta.url).href
  )) as StaticCore;
}

function fakeDb() {
  return { exec: () => undefined, changes: () => 0, close: () => undefined };
}

function noModificationError(): Error {
  const error = new Error('createSyncAccessHandle found another Access Handle');
  error.name = 'NoModificationAllowedError';
  return error;
}

function sqliteCtor<T>(db: T): new () => T {
  return function fakeSqliteConstructor() {
    return db;
  } as unknown as new () => T;
}
