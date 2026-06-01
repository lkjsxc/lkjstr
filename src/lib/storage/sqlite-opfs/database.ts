import type {
  OpenDatabase,
  SqlParams,
  SqlRow,
  SqlStep,
  StorageDiagnostics,
  StorageOutcome,
} from './types';

export type SqliteDatabase = {
  readonly filename?: string;
  exec: (input: string | ExecOptions) => unknown;
  changes: (total?: boolean, sixtyFour?: false) => number;
  close: () => void;
};

type DbOptions = {
  readonly filename?: string;
  readonly flags?: string;
  readonly vfs?: string;
};

type SqliteDbConstructor = new (options?: DbOptions) => SqliteDatabase;

type SqliteOpfsConstructor = new (
  filename: string,
  flags?: string,
) => SqliteDatabase;

export type SqliteModule = {
  readonly oo1: {
    readonly DB: SqliteDbConstructor;
    readonly OpfsDb?: SqliteOpfsConstructor;
  };
  readonly installOpfsSAHPoolVfs?: (options: {
    readonly name?: string;
  }) => Promise<{
    readonly OpfsSAHPoolDb: SqliteOpfsConstructor;
  }>;
};

type ExecOptions = {
  readonly sql: string;
  readonly bind?: SqlParams;
  readonly rowMode?: 'object';
  readonly returnValue?: 'resultRows';
};

export type OpenedSqliteDatabase = {
  readonly db: SqliteDatabase;
  readonly diagnostics: StorageDiagnostics;
};

export async function openSqliteDatabase(
  sqlite3: SqliteModule,
  request: OpenDatabase,
): Promise<OpenedSqliteDatabase> {
  const filename = normalizeFilename(request.databaseName);
  if (request.preferredVfs !== 'opfs-sahpool' && sqlite3.oo1.OpfsDb) {
    const db = new sqlite3.oo1.OpfsDb(filename, 'c');
    return { db, diagnostics: diagnostics(request.databaseName, 'opfs') };
  }
  if (request.allowSahpool && sqlite3.installOpfsSAHPoolVfs) {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'lkjstr' });
    const db = new pool.OpfsSAHPoolDb(filename, 'c');
    return {
      db,
      diagnostics: diagnostics(request.databaseName, 'opfs-sahpool'),
    };
  }
  if (request.allowTransient) {
    const db = new sqlite3.oo1.DB({ filename: ':memory:', flags: 'c' });
    return { db, diagnostics: diagnostics(request.databaseName, 'memory') };
  }
  throw new Error('OPFS SQLite storage is unavailable');
}

export function executeSql(
  db: SqliteDatabase,
  statement: string,
  params?: SqlParams,
): number {
  db.exec({ sql: statement, bind: params });
  return db.changes(false, false);
}

export function querySql(
  db: SqliteDatabase,
  statement: string,
  params: SqlParams | undefined,
  rowLimit: number,
): SqlRow[] {
  const rows = db.exec({
    sql: statement,
    bind: params,
    rowMode: 'object',
    returnValue: 'resultRows',
  });
  return Array.isArray(rows) ? rows.filter(isSqlRow).slice(0, rowLimit) : [];
}

export function runBatch(
  db: SqliteDatabase,
  steps: readonly SqlStep[],
): number {
  let rowsAffected = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const step of steps)
      rowsAffected += executeSql(db, step.statement, step.params);
    db.exec('COMMIT');
    return rowsAffected;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function sqliteOutcomeFromError(error: unknown): StorageOutcome {
  const text = errorText(error);
  if (/cancel/i.test(text)) return 'canceled';
  if (/busy|locked/i.test(text)) return 'busy';
  if (/quota|full|space/i.test(text)) return 'quota';
  if (/blocked/i.test(text)) return 'blocked';
  if (/corrupt|malformed|schema/i.test(text)) return 'corrupt';
  return 'unavailable';
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function normalizeFilename(name: string): string {
  return name.startsWith('/') ? name : `/${name}`;
}

function diagnostics(databaseName: string, vfs: string): StorageDiagnostics {
  return { databaseName, vfs };
}

function isSqlRow(value: unknown): value is SqlRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
