import { describe, expect, test, vi } from 'vitest';
import type { AppLogRecord } from '../../../src/lib/log/app-log';
import type {
  StorageOp,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

const state = vi.hoisted(() => ({
  rows: [] as StorageResponse['rows'],
  rowsAffected: 0,
  sent: [] as StorageOp[],
}));

vi.mock('../../../src/lib/storage/sqlite-opfs/kernel-client', () => ({
  applySqliteSchema: async () => response('ok'),
  sendSqliteStorage: async (op: StorageOp) => {
    state.sent.push(op);
    if (op.kind === 'query') return response('ok', state.rows);
    return response('ok', [], state.rowsAffected);
  },
}));

const { sqliteAppendAppLog, sqliteClearRecoverableAppLog, sqliteListAppLog } =
  await import('../../../src/lib/storage/sqlite-opfs/app-log-repository');

describe('SQLite app log repository', () => {
  test('appends redacted app log records with bounded retention', async () => {
    state.sent = [];
    await expect(sqliteAppendAppLog(logRecord('a', 10))).resolves.toBe(true);

    const batch = state.sent.find((op) => op.kind === 'batch');
    expect(batch?.kind === 'batch' ? batch.steps : []).toHaveLength(3);
    expect(batch?.kind === 'batch' ? batch.steps[0]?.statement : '').toContain(
      'INSERT INTO app_log',
    );
    expect(batch?.kind === 'batch' ? batch.steps[2]?.statement : '').toContain(
      'OFFSET ?1',
    );
  });

  test('lists only decodable durable log rows newest first', async () => {
    state.sent = [];
    const row = logRecord('b', 20);
    state.rows = [
      { record_json: JSON.stringify(row) },
      { record_json: '{not-json' },
    ];

    await expect(sqliteListAppLog(10)).resolves.toEqual([row]);
    const query = state.sent.find((op) => op.kind === 'query');
    expect(query?.kind === 'query' ? query.statement : '').toContain(
      'ORDER BY created_at_ms DESC',
    );
  });

  test('clears recoverable app log rows by timestamp', async () => {
    state.sent = [];
    state.rowsAffected = 2;

    await expect(sqliteClearRecoverableAppLog(30)).resolves.toBe(2);
    const execute = state.sent.find((op) => op.kind === 'execute');
    expect(execute?.kind === 'execute' ? execute.params : []).toEqual([30]);
  });
});

function response(
  outcome: StorageResponse['outcome'],
  rows: StorageResponse['rows'] = [],
  rowsAffected = 0,
): StorageResponse {
  return { requestId: 'test', outcome, rows, rowsAffected, diagnostics: {} };
}

function logRecord(id: string, timestamp: number): AppLogRecord {
  return {
    id,
    timestamp,
    area: 'runtime',
    severity: 'error',
    code: 'window-error',
    message: 'failed',
    context: { secret: '[redacted]' },
  };
}
