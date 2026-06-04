import { describe, expect, test, vi } from 'vitest';
import type { NotificationRecord } from '../../../src/lib/notifications/notification';
import type {
  StorageOp,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

const state = vi.hoisted(() => ({
  sent: [] as StorageOp[],
  query: (() => []) as (
    op: Extract<StorageOp, { kind: 'query' }>,
  ) => StorageResponse['rows'],
  rowsAffected: 0,
}));

vi.mock('../../../src/lib/storage/sqlite-opfs/kernel-client', () => ({
  applySqliteSchema: async () => response('ok'),
  sendSqliteStorage: async (op: StorageOp) => {
    state.sent.push(op);
    if (op.kind === 'query') return response('ok', state.query(op));
    return response('ok', [], state.rowsAffected);
  },
}));

const { sqliteCacheLedgerHealth, sqliteRepairCacheLedger } =
  await import('../../../src/lib/storage/sqlite-opfs/cache-ledger-repair-sqlite');

describe('SQLite cache ledger repair', () => {
  test('counts orphan ledger rows only when SQLite proves target absence', async () => {
    state.sent = [];
    state.query = (op) => {
      if (op.statement.includes('FROM cache_ledger WHERE id >'))
        return [{ id: 'event:missing', record_json: JSON.stringify(ledger()) }];
      if (op.statement.includes('SELECT 1 AS found FROM events')) return [];
      return [];
    };

    await expect(sqliteCacheLedgerHealth()).resolves.toEqual({
      orphanLedgerRows: 1,
      missingLedgerRows: 0,
      unavailableTargets: 0,
    });
  });

  test('backfills missing ledger rows from SQLite resource rows', async () => {
    state.sent = [];
    const notification = notificationRecord();
    state.query = (op) => {
      if (op.statement.includes('FROM notifications WHERE id >'))
        return [
          { id: notification.id, record_json: JSON.stringify(notification) },
        ];
      return [];
    };

    await expect(sqliteRepairCacheLedger()).resolves.toMatchObject({
      missingLedgerRowsInserted: 1,
      orphanLedgerRowsDeleted: 0,
    });
    const batch = state.sent.find((op) => op.kind === 'batch');
    expect(batch?.kind === 'batch' ? batch.steps[0]?.statement : '').toContain(
      'INSERT INTO cache_ledger',
    );
  });

  test('skips protected orphan ledger rows during repair', async () => {
    state.sent = [];
    state.query = (op) => {
      if (op.statement.includes('FROM cache_ledger WHERE id >'))
        return [
          {
            id: 'event:missing',
            record_json: JSON.stringify({ ...ledger(), protected: true }),
          },
        ];
      if (op.statement.includes('SELECT 1 AS found FROM events')) return [];
      return [];
    };

    await expect(sqliteRepairCacheLedger()).resolves.toMatchObject({
      orphanLedgerRowsDeleted: 0,
      skippedProtectedRows: 1,
    });
    expect(
      state.sent.some(
        (op) => op.kind === 'execute' && op.statement.includes('cache_ledger'),
      ),
    ).toBe(false);
  });
});

function response(
  outcome: StorageResponse['outcome'],
  rows: StorageResponse['rows'] = [],
  rowsAffected = 0,
): StorageResponse {
  return { requestId: 'test', outcome, rows, rowsAffected, diagnostics: {} };
}

function ledger() {
  return {
    id: 'event:missing',
    ownerKind: 'event',
    resourceKind: 'nostr-event',
    resourceId: 'missing',
    score: 1,
    createdAt: 1,
    updatedAt: 1,
    cacheBytes: 1,
    protected: false,
  };
}

function notificationRecord(): NotificationRecord {
  return {
    id: 'acct:event:mention',
    accountPubkey: 'acct',
    sourceEventId: 'event',
    actorPubkey: 'actor',
    kind: 'mention',
    createdAt: 10,
    receivedAt: 20,
    readAt: null,
    muted: false,
    hidden: false,
    relayUrls: ['cache'],
  };
}
