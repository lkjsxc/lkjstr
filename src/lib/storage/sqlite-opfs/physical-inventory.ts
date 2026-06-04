import { errorText, querySql } from './database';
import type { OpenedSqliteDatabase } from './open-database';
import type { SqlRow } from './types';

const maxTables = 200;
const sqliteInternalPrefix = 'sqlite_';

export function readPhysicalInventoryRows(
  current: OpenedSqliteDatabase,
): SqlRow[] {
  const names = tableNames(current);
  return names.map((name) => tableRow(current, name));
}

function tableNames(current: OpenedSqliteDatabase): string[] {
  return querySql(
    current.db,
    `SELECT name FROM sqlite_schema
     WHERE type = 'table' AND name NOT LIKE ?1
     ORDER BY name ASC;`,
    [`${sqliteInternalPrefix}%`],
    maxTables,
  )
    .map((row) => row.name)
    .filter((name): name is string => typeof name === 'string');
}

function tableRow(current: OpenedSqliteDatabase, table: string): SqlRow {
  try {
    const count = countRows(current, table);
    return {
      table,
      row_count: count,
      estimated_bytes: count * 256,
      status: 'estimated',
    };
  } catch (error) {
    return {
      table,
      row_count: null,
      estimated_bytes: 0,
      status: 'unavailable',
      reason: errorText(error),
    };
  }
}

function countRows(current: OpenedSqliteDatabase, table: string): number {
  const [row] = querySql(
    current.db,
    `SELECT COUNT(*) AS row_count FROM ${quoteIdent(table)};`,
    undefined,
    1,
  );
  const count = row?.row_count;
  return typeof count === 'number' ? count : 0;
}

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
