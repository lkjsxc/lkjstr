import type { AppLogRecord } from '../../log/app-log';
import { applySqliteSchema, sendSqliteStorage } from './kernel-client';
import type { SqlRow, SqlStep } from './types';

const maxDurableRows = 1_000;
const maxDurableAgeMs = 30 * 24 * 60 * 60 * 1_000;
const appLogSchemaHash = 'app-log-durable-rows';
const appLogSchema = [
  `CREATE TABLE IF NOT EXISTS app_log (
  log_id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  level TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT NOT NULL,
  record_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS app_log_time_idx ON app_log(created_at_ms DESC, log_id DESC);',
];

export async function sqliteAppendAppLog(
  record: AppLogRecord,
): Promise<boolean> {
  if (!(await ensureAppLogSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'batch',
      mode: 'readwrite',
      steps: [insertStep(record), deleteOldStep(record.timestamp), trimStep()],
    },
    { deadlineMs: 5_000 },
  );
  return response.outcome === 'ok';
}

export async function sqliteListAppLog(
  limit = 300,
  beforeMs?: number,
): Promise<AppLogRecord[]> {
  if (!(await ensureAppLogSchema())) return [];
  const params = beforeMs === undefined ? [limit] : [beforeMs, limit];
  const where = beforeMs === undefined ? '' : 'WHERE created_at_ms < ?1';
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement: `SELECT record_json FROM app_log ${where} ORDER BY created_at_ms DESC, log_id DESC LIMIT ?${params.length};`,
      params,
      rowLimit: limit,
    },
    { deadlineMs: 5_000 },
  );
  if (response.outcome !== 'ok') return [];
  return response.rows.flatMap(decodeAppLogRow);
}

export async function sqliteClearRecoverableAppLog(
  beforeMs = Date.now(),
): Promise<number> {
  if (!(await ensureAppLogSchema())) return 0;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement: 'DELETE FROM app_log WHERE created_at_ms <= ?1;',
      params: [beforeMs],
    },
    { deadlineMs: 5_000 },
  );
  return response.outcome === 'ok' ? response.rowsAffected : 0;
}

async function ensureAppLogSchema(): Promise<boolean> {
  const response = await applySqliteSchema(appLogSchemaHash, appLogSchema);
  return response.outcome === 'ok';
}

function insertStep(record: AppLogRecord): SqlStep {
  return {
    statement:
      'INSERT INTO app_log (log_id, area, level, code, message, context_json, record_json, created_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(log_id) DO UPDATE SET area = excluded.area, level = excluded.level, code = excluded.code, message = excluded.message, context_json = excluded.context_json, record_json = excluded.record_json, created_at_ms = excluded.created_at_ms;',
    params: [
      record.id,
      record.area,
      record.severity,
      record.code,
      record.message,
      JSON.stringify(record.context ?? {}),
      JSON.stringify(record),
      record.timestamp,
    ],
  };
}

function deleteOldStep(nowMs: number): SqlStep {
  return {
    statement: 'DELETE FROM app_log WHERE created_at_ms < ?1;',
    params: [nowMs - maxDurableAgeMs],
  };
}

function trimStep(): SqlStep {
  return {
    statement:
      'DELETE FROM app_log WHERE log_id IN (SELECT log_id FROM app_log ORDER BY created_at_ms DESC, log_id DESC LIMIT -1 OFFSET ?1);',
    params: [maxDurableRows],
  };
}

function decodeAppLogRow(row: SqlRow): AppLogRecord[] {
  try {
    const value = JSON.parse(String(row.record_json ?? ''));
    return isAppLogRecord(value) ? [value] : [];
  } catch {
    return [];
  }
}

function isAppLogRecord(value: unknown): value is AppLogRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.timestamp === 'number' &&
    typeof record.area === 'string' &&
    typeof record.severity === 'string' &&
    typeof record.code === 'string' &&
    typeof record.message === 'string'
  );
}
