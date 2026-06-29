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

function sqliteCtor<T>(db: T): new () => T {
  return function fakeSqliteConstructor() {
    return db;
  } as unknown as new () => T;
}
