import { afterEach, describe, expect, it, vi } from 'vitest';

describe('compaction protection snapshots', () => {
  afterEach(() => vi.resetModules());

  it('protects active tabs and notification source events', async () => {
    mockSqlite({
      events: [],
      protectedRows: [],
      notifications: [notification('n1', 'source', 'root', 'target')],
      workspace: { id: 'w1', tabs: { t1: {} } },
    });
    const protection =
      await import('../../../src/lib/storage/retention/protection');

    const snapshot = await protection.protectionSnapshot();
    expect(snapshot.complete).toBe(true);
    expect(snapshot.ids.has('w1:t1')).toBe(true);
    expect(snapshot.ids.has('tab-snapshot:w1:t1')).toBe(true);
    expect(snapshot.ids.has('source')).toBe(true);
    expect(snapshot.ids.has('root')).toBe(true);
    expect(snapshot.ids.has('target')).toBe(true);
  });

  it('marks protection incomplete when scans hit the row budget', async () => {
    mockSqlite({
      events: [
        { id: 'e1', pubkey: 'p1', kind: 0, created_at: 1 },
        { id: 'e2', pubkey: 'p2', kind: 0, created_at: 2 },
      ],
      protectedRows: [],
      notifications: [],
    });
    const protection =
      await import('../../../src/lib/storage/retention/protection');

    const snapshot = await protection.protectionSnapshot({ scanLimit: 1 });
    expect(snapshot.complete).toBe(false);
    expect(snapshot.reason).toBe('scan-limit');
  });
});

type MockSqlite = {
  readonly events: readonly unknown[];
  readonly protectedRows: readonly unknown[];
  readonly notifications: readonly unknown[];
  readonly workspace?: unknown;
};

function mockSqlite(input: MockSqlite): void {
  vi.doMock('../../../src/lib/storage/sqlite-opfs/event-schema', () => ({
    ensureEventGraphSchema: async () => true,
  }));
  vi.doMock('../../../src/lib/storage/sqlite-opfs/accounts-sqlite', () => ({
    sqliteReadAccounts: async () => [],
  }));
  vi.doMock('../../../src/lib/storage/sqlite-opfs/workspace-sqlite', () => ({
    sqliteReadWorkspace: async () => input.workspace,
  }));
  vi.doMock('../../../src/lib/storage/sqlite-opfs/kernel-client', () => ({
    sendSqliteStorage: async (op: { readonly statement: string }) => ({
      outcome: 'ok',
      rows: rowsFor(input, op.statement),
    }),
  }));
}

function rowsFor(input: MockSqlite, statement: string): readonly unknown[] {
  if (statement.includes('FROM events')) return input.events;
  if (statement.includes('FROM cache_ledger')) return input.protectedRows;
  if (statement.includes('FROM notifications'))
    return input.notifications.map((row) => ({
      record_json: JSON.stringify(row),
    }));
  return [];
}

function notification(
  id: string,
  sourceEventId: string,
  rootEventId: string,
  targetEventId: string,
) {
  return {
    id,
    accountPubkey: 'account',
    sourceEventId,
    rootEventId,
    targetEventId,
    createdAt: Math.floor(Date.now() / 1000),
    readAt: null,
  };
}
