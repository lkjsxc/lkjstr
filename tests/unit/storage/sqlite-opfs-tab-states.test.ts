import { describe, expect, test, vi } from 'vitest';
import type {
  StorageOp,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

const state = vi.hoisted(() => ({
  sent: [] as StorageOp[],
  rows: [] as StorageResponse['rows'],
}));

vi.mock('../../../src/lib/storage/sqlite-opfs/kernel-client', () => ({
  applySqliteSchema: async () => response('ok'),
  sendSqliteStorage: async (op: StorageOp) => {
    state.sent.push(op);
    if (op.kind === 'query') return response('ok', state.rows);
    return response('ok');
  },
}));

const { sqlitePutTabState, sqliteReadTabState, sqliteDeleteTabStates } =
  await import('../../../src/lib/storage/sqlite-opfs/tab-states-sqlite');

describe('SQLite tab state repository', () => {
  test('writes tab state with ledger and reads JSON records', async () => {
    const row = {
      id: 'main:tab',
      workspaceId: 'main',
      tabId: 'tab',
      state: { scrollTop: 10 },
      updatedAt: 5,
    };
    await sqlitePutTabState(row, ledger('main:tab'));
    expect(state.sent.find((op) => op.kind === 'batch')).toBeTruthy();
    state.rows = [{ record_json: JSON.stringify(row) }];
    await expect(sqliteReadTabState('main:tab')).resolves.toEqual(row);
  });

  test('deletes tab states and ledger rows together', async () => {
    state.sent = [];
    await sqliteDeleteTabStates(['main:tab']);
    const batch = state.sent.find((op) => op.kind === 'batch');
    expect(batch?.kind === 'batch' ? batch.steps.length : 0).toBe(3);
  });
});

function response(
  outcome: StorageResponse['outcome'],
  rows: StorageResponse['rows'] = [],
): StorageResponse {
  return { requestId: 'test', outcome, rows, rowsAffected: 0, diagnostics: {} };
}

function ledger(id: string) {
  return {
    id,
    ownerKind: 'tab-snapshot' as const,
    resourceKind: 'tab-state' as const,
    resourceId: id,
    score: 1,
    createdAt: 1,
    updatedAt: 1,
    cacheBytes: 1,
    protected: false,
  };
}
