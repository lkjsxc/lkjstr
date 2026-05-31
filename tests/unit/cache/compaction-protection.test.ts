import { afterEach, describe, expect, it, vi } from 'vitest';

describe('compaction protection snapshots', () => {
  afterEach(() => vi.resetModules());

  it('protects active tabs and notification source events', async () => {
    mockDb({
      events: eventKindRows([]),
      accounts: rowTable([]),
      workspaces: rowTable([{ id: 'w1', tabs: { t1: {} } }]),
      notifications: orderedRows([
        notification('n1', 'source', 'root', 'target'),
      ]),
      cacheLedger: protectedLedgerRows([]),
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
    mockDb({
      events: eventKindRows([
        { id: 'e1', pubkey: 'p1', kind: 0, created_at: 1 },
        { id: 'e2', pubkey: 'p2', kind: 0, created_at: 2 },
      ]),
      accounts: rowTable([]),
      workspaces: rowTable([]),
      notifications: orderedRows([]),
      cacheLedger: protectedLedgerRows([]),
    });
    const protection =
      await import('../../../src/lib/storage/retention/protection');
    const snapshot = await protection.protectionSnapshot({ scanLimit: 1 });
    expect(snapshot.complete).toBe(false);
    expect(snapshot.reason).toBe('scan-limit');
  });
});

function mockDb(db: unknown): void {
  vi.doMock('../../../src/lib/storage/browser-db', () => ({
    browserDb: () => db,
  }));
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
    actorPubkey: 'actor',
    kind: 'reply',
    createdAt: Math.floor(Date.now() / 1000),
    receivedAt: Date.now(),
    readAt: null,
    muted: false,
    hidden: false,
    relayUrls: [],
  };
}

function eventKindRows(rows: unknown[]) {
  return {
    where: () => ({
      between: () => rowTable(rows),
    }),
  };
}

function orderedRows(rows: unknown[]) {
  return {
    orderBy: () => ({
      reverse: () => rowTable(rows),
    }),
  };
}

function protectedLedgerRows(rows: unknown[]) {
  return {
    where: () => ({
      equals: () => ({
        filter: () => rowTable(rows),
      }),
    }),
  };
}

function rowTable(rows: unknown[]) {
  return {
    each: async (visit: (row: unknown) => false | void) => {
      for (const row of rows) if (visit(row) === false) break;
    },
  };
}
