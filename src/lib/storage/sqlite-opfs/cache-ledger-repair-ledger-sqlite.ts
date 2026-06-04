import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import { ensureCacheLedgerSchema } from './cache-ledger-sqlite';
import { sendSqliteStorage } from './kernel-client';
import { cacheLedgerSqlStep, sqliteRecordBatch } from './sqlite-record-helpers';
import type { SqlRow, SqlScalar } from './types';

export async function visitSqliteLedgerRows(
  limit: number,
  visit: (row: CacheLedgerRecord) => Promise<void>,
): Promise<void> {
  if (!(await ensureCacheLedgerSchema())) return;
  let cursor = '';
  while (true) {
    const rows = await queryRows(
      'SELECT id, record_json FROM cache_ledger WHERE id > ?1 ORDER BY id ASC LIMIT ?2;',
      [cursor, limit],
      limit,
    );
    if (!rows || rows.length === 0) break;
    for (const row of rows.flatMap((item) => decodeLedger(item.record_json)))
      await visit(row);
    cursor = String(rows[rows.length - 1]?.id ?? '');
    if (rows.length < limit) break;
  }
}

export async function readSqliteLedgerRecord(
  id: string,
): Promise<CacheLedgerRecord | undefined> {
  if (!(await ensureCacheLedgerSchema())) return undefined;
  const rows = await queryRows(
    'SELECT record_json FROM cache_ledger WHERE id = ?1 LIMIT 1;',
    [id],
    1,
  );
  return rows?.flatMap((row) => decodeLedger(row.record_json))[0];
}

export async function flushSqliteLedgerRows(
  rows: CacheLedgerRecord[],
): Promise<void> {
  if (rows.length === 0) return;
  const batch = rows.splice(0, rows.length);
  await sqliteRecordBatch(
    ensureCacheLedgerSchema,
    batch.map(cacheLedgerSqlStep),
  );
}

export async function deleteSqliteLedgerIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = ids.splice(0, ids.length);
  await execute(
    `DELETE FROM cache_ledger WHERE id IN (${placeholders(batch)});`,
    batch,
  );
}

export async function executeSqliteStorage(
  statement: string,
  params: readonly SqlScalar[] = [],
): Promise<number> {
  return execute(statement, params);
}

async function queryRows(
  statement: string,
  params: readonly SqlScalar[],
  rowLimit: number,
): Promise<readonly SqlRow[] | undefined> {
  const response = await sendSqliteStorage({
    kind: 'query',
    statement,
    params,
    rowLimit,
  });
  return response.outcome === 'ok' ? response.rows : undefined;
}

async function execute(
  statement: string,
  params: readonly SqlScalar[] = [],
): Promise<number> {
  const response = await sendSqliteStorage({
    kind: 'execute',
    statement,
    params,
  });
  return response.outcome === 'ok' ? response.rowsAffected : 0;
}

function placeholders(values: readonly unknown[]): string {
  return values.map((_, index) => `?${index + 1}`).join(', ');
}

function decodeLedger(raw: unknown): CacheLedgerRecord[] {
  if (typeof raw !== 'string') return [];
  try {
    return [JSON.parse(raw) as CacheLedgerRecord];
  } catch {
    return [];
  }
}
