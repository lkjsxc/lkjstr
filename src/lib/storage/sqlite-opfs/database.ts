import type { SqlParams, SqlRow, SqlStep, StorageOutcome } from './types';

export type SqliteDatabase = {
  readonly filename?: string;
  exec: (input: string | ExecOptions) => unknown;
  changes: (total?: boolean, sixtyFour?: false) => number;
  close: () => void;
};

export type DbOptions = {
  readonly filename?: string;
  readonly flags?: string;
  readonly vfs?: string;
};

export type SqliteDbConstructor = new (options?: DbOptions) => SqliteDatabase;
export type SqliteOpfsConstructor = new (
  filename: string,
  flags?: string,
) => SqliteDatabase;

export type SqliteModule = {
  readonly oo1: {
    readonly DB: SqliteDbConstructor;
    readonly OpfsDb?: SqliteOpfsConstructor;
  };
  readonly capi?: { readonly sqlite3_libversion?: () => string };
  readonly version?: { readonly libVersion?: string };
  readonly installOpfsSAHPoolVfs?: (options: {
    readonly name?: string;
    readonly initialCapacity?: number;
  }) => Promise<{ readonly OpfsSAHPoolDb: SqliteOpfsConstructor }>;
};

type ExecOptions = {
  readonly sql: string;
  readonly bind?: SqlParams;
  readonly rowMode?: 'object';
  readonly returnValue?: 'resultRows';
};

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

function isSqlRow(value: unknown): value is SqlRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
