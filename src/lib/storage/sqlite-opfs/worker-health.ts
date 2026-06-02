import { errorText, querySql, type SqliteModule } from './database';
import { sqliteVersion, type OpenedSqliteDatabase } from './open-database';
import type { StorageHealth } from './types';

export type StorageHealthInput = {
  readonly current: OpenedSqliteDatabase;
  readonly sqliteModule: SqliteModule | undefined;
  readonly appliedSchemaChanges: Iterable<string>;
  readonly lastIntegrityCheckAt: number | null;
};

export function createStorageHealth(input: StorageHealthInput): StorageHealth {
  const warnings = [...(input.current.diagnostics.warnings ?? [])];
  return {
    mode: input.current.diagnostics.mode ?? 'temporary-memory',
    vfsName: input.current.diagnostics.vfsName ?? 'memory',
    workerKind: input.current.diagnostics.workerKind ?? 'unknown',
    sqliteVersion: input.sqliteModule
      ? sqliteVersion(input.sqliteModule)
      : 'unknown',
    databaseName: input.current.diagnostics.databaseName ?? ':memory:',
    appliedSchemaChanges: [...input.appliedSchemaChanges],
    pageCount: pragmaNumber(input.current, 'page_count', warnings),
    pageSize: pragmaNumber(input.current, 'page_size', warnings),
    freelistCount: pragmaNumber(input.current, 'freelist_count', warnings),
    eventCount: tableCount(input.current, 'events', warnings),
    relayReceiptCount: tableCount(input.current, 'event_relays', warnings),
    tagRowCount: tableCount(input.current, 'event_tags', warnings),
    lastIntegrityCheckAt: input.lastIntegrityCheckAt,
    warnings,
  };
}

function pragmaNumber(
  current: OpenedSqliteDatabase,
  name: string,
  warnings: string[],
): number {
  return firstNumber(current, `PRAGMA ${name};`, name, warnings);
}

function tableCount(
  current: OpenedSqliteDatabase,
  table: string,
  warnings: string[],
): number {
  return firstNumber(
    current,
    `SELECT COUNT(*) AS row_count FROM ${table};`,
    'row_count',
    warnings,
  );
}

function firstNumber(
  current: OpenedSqliteDatabase,
  sql: string,
  key: string,
  warnings: string[],
): number {
  try {
    const [row] = querySql(current.db, sql, undefined, 1);
    const value = row?.[key];
    return typeof value === 'number' ? value : 0;
  } catch (error) {
    warnings.push(`${key}: ${errorText(error)}`);
    return 0;
  }
}
