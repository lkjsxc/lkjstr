import { describe, expect, test } from 'vitest';
import { readSqliteStorageHealth } from '../../../src/lib/storage/sqlite-opfs/storage-health';
import type {
  StorageHealth,
  StorageRequest,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

describe('SQLite storage health reader', () => {
  test('opens storage and returns worker health', async () => {
    const sent: StorageRequest['op'][] = [];
    const status = await readSqliteStorageHealth({
      createClient: () => fakeClient(sent, 'ok'),
    });

    expect(sent[0]).toMatchObject({
      kind: 'open',
      database: { databaseName: '/lkjstr/main.sqlite3' },
    });
    expect(sent[1]).toEqual({ kind: 'get-storage-health' });
    expect(status).toMatchObject({
      status: 'available',
      health: { mode: 'persistent-opfs', vfsName: 'opfs-sahpool' },
    });
  });

  test('reports unavailable open outcome', async () => {
    const status = await readSqliteStorageHealth({
      createClient: () => fakeClient([], 'unavailable'),
    });

    expect(status).toEqual({
      status: 'unavailable',
      message: 'SQLite storage response outcome: unavailable',
    });
  });
});

function fakeClient(
  sent: StorageRequest['op'][],
  openOutcome: StorageResponse['outcome'],
) {
  return {
    send: async (op: StorageRequest['op']) => {
      sent.push(op);
      if (op.kind === 'open') return response(openOutcome);
      return response('ok', health);
    },
    close: async () => undefined,
    terminate: () => undefined,
    diagnostics: () => ({ lateSettled: 0, lateRejected: 0, pending: 0 }),
  };
}

function response(
  outcome: StorageResponse['outcome'],
  value?: StorageHealth,
): StorageResponse {
  return {
    requestId: 'test',
    outcome,
    rows: [],
    rowsAffected: 0,
    diagnostics: value ? { health: value } : {},
  };
}

const health: StorageHealth = {
  mode: 'persistent-opfs',
  vfsName: 'opfs-sahpool',
  workerKind: 'dedicated',
  sqliteVersion: '3.test',
  databaseName: '/lkjstr/main.sqlite3',
  appliedSchemaChanges: [],
  pageCount: 1,
  pageSize: 4096,
  freelistCount: 0,
  eventCount: 0,
  relayReceiptCount: 0,
  tagRowCount: 0,
  lastIntegrityCheckAt: null,
  warnings: [],
};
