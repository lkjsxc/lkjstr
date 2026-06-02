import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import { sendSqliteStorage } from './kernel-client';
import type { SqlScalar, SqlStep } from './types';

export type SchemaGuard = () => Promise<boolean>;

export async function sqliteRecordBatch(
  ensureSchema: SchemaGuard,
  steps: readonly SqlStep[],
): Promise<boolean> {
  if (steps.length === 0) return true;
  if (!(await ensureSchema())) return false;
  const response = await sendSqliteStorage(
    { kind: 'batch', mode: 'readwrite', steps },
    { deadlineMs: 5_000 },
  );
  return response.outcome === 'ok';
}

export async function sqliteRecordReadOne<T>(
  ensureSchema: SchemaGuard,
  table: string,
  whereSql: string,
  params: readonly SqlScalar[],
): Promise<T | undefined> {
  return (
    await sqliteRecordReadMany<T>(ensureSchema, table, whereSql, params, 1)
  )?.[0];
}

export async function sqliteRecordReadMany<T>(
  ensureSchema: SchemaGuard,
  table: string,
  whereSql: string,
  params: readonly SqlScalar[],
  limit: number,
): Promise<T[] | undefined> {
  if (!(await ensureSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement: `SELECT record_json FROM ${table} WHERE ${whereSql};`,
      params,
      rowLimit: limit,
    },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows.flatMap((row) => decodeJson<T>(row.record_json));
}

export function jsonRecordStep<T>(
  table: string,
  key: string,
  id: string,
  row: T,
  updatedAt: number,
): SqlStep {
  return {
    statement: `INSERT INTO ${table} (${key}, record_json, updated_at_ms) VALUES (?1, ?2, ?3) ON CONFLICT(${key}) DO UPDATE SET record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;`,
    params: [id, JSON.stringify(row), updatedAt],
  };
}

export function cacheLedgerSqlStep(row: CacheLedgerRecord): SqlStep {
  return {
    statement:
      'INSERT INTO cache_ledger (id, owner_kind, resource_kind, resource_id, score, protected, record_json, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(id) DO UPDATE SET score = excluded.score, protected = excluded.protected, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.ownerKind,
      row.resourceKind,
      row.resourceId,
      row.score,
      row.protected ? 1 : 0,
      JSON.stringify(row),
      row.createdAt,
      row.updatedAt,
    ],
  };
}

function decodeJson<T>(raw: unknown): T[] {
  if (typeof raw !== 'string') return [];
  try {
    return [JSON.parse(raw) as T];
  } catch {
    return [];
  }
}
