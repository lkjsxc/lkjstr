import { describe, expect, test, vi } from 'vitest';
import type { StorageOp, StorageResponse } from '../../../src/lib/storage/sqlite-opfs/types';
import type { StoredEvent } from '../../../src/lib/events/types';

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

const { sqliteReadStoredEvent, sqlitePutStoredEventWithLedger } =
  await import('../../../src/lib/storage/sqlite-opfs/events-sqlite');
const { sqliteIndexedPage } =
  await import('../../../src/lib/storage/sqlite-opfs/event-pages-sqlite');
const { sqlitePutNotificationsWithLedger, sqliteReadAccountNotifications } =
  await import('../../../src/lib/storage/sqlite-opfs/notifications-sqlite');

describe('SQLite event graph repositories', () => {
  test('decodes stored events from SQLite rows', async () => {
    state.rows = [eventRow(storedEvent('a', 10, ['wss://relay.example']))];

    await expect(sqliteReadStoredEvent('a')).resolves.toMatchObject({
      id: 'a',
      relayUrls: ['wss://relay.example'],
    });
  });

  test('writes event, relay receipt, tag rows, and ledger in one batch', async () => {
    state.sent = [];
    const event = storedEvent('b', 20, ['wss://relay.example']);
    await sqlitePutStoredEventWithLedger(
      {
        event,
        stored: event,
        receipts: [
          {
            id: 'b:wss://relay.example',
            eventId: 'b',
            relayUrl: 'wss://relay.example',
            receivedAt: 30,
          },
        ],
        tags: [
          {
            id: 'b:e:root:0',
            eventId: 'b',
            tagName: 'e',
            tagValue: 'root',
            created_at: 20,
          },
        ],
        receivedAt: 30,
      },
      {
        id: 'event:b',
        ownerKind: 'event',
        resourceKind: 'nostr-event',
        resourceId: 'b',
        score: 1,
        createdAt: 20,
        updatedAt: 30,
        cacheBytes: 100,
        protected: false,
      },
    );

    const batch = state.sent.find((op) => op.kind === 'batch');
    expect(batch).toMatchObject({ kind: 'batch', steps: expect.any(Array) });
    expect(batch?.kind === 'batch' ? batch.steps.length : 0).toBe(5);
  });

  test('queries global pages with SQL ordering', async () => {
    state.sent = [];
    state.rows = [eventRow(storedEvent('c', 30, ['cache']))];

    await expect(
      sqliteIndexedPage(
        { kind: 'global', kinds: [1], relays: ['wss://relay.example'], limit: 10 },
        10,
      ),
    ).resolves.toHaveLength(1);
    const query = state.sent.find((op) => op.kind === 'query');
    expect(query?.kind === 'query' ? query.statement : '').toContain(
      'JOIN event_relays r ON r.event_id = e.id',
    );
    expect(query?.kind === 'query' ? query.statement : '').toContain(
      'ORDER BY e.created_at DESC, e.id ASC',
    );
  });

  test('filters global pages to selected relay provenance', async () => {
    state.sent = [];
    state.rows = [eventRow(storedEvent('d', 31, ['wss://selected.example']))];

    await sqliteIndexedPage(
      {
        kind: 'global',
        kinds: [1],
        relays: ['wss://selected.example'],
        limit: 10,
      },
      10,
    );
    const query = state.sent.find((op) => op.kind === 'query');
    expect(query?.kind === 'query' ? query.params : []).toContain(
      'wss://selected.example',
    );
  });

  test('uses a set query for many author pages', async () => {
    state.sent = [];
    state.rows = [eventRow(storedEvent('e', 32, ['wss://relay.example']))];

    await sqliteIndexedPage(
      { kind: 'home', authors: ['a', 'b'], kinds: [1], limit: 10 },
      10,
    );
    const query = state.sent.find((op) => op.kind === 'query');
    expect(query?.kind === 'query' ? query.statement : '').toContain(
      'WITH author_input(pubkey) AS (VALUES (?1), (?2))',
    );
  });

  test('writes and reads notification rows through JSON records', async () => {
    state.sent = [];
    const record = {
      id: 'acct:e:mention',
      accountPubkey: 'acct',
      sourceEventId: 'e',
      actorPubkey: 'actor',
      kind: 'mention' as const,
      createdAt: 50,
      receivedAt: 60,
      readAt: null,
      muted: false,
      hidden: false,
      relayUrls: ['cache'],
    };
    await sqlitePutNotificationsWithLedger(
      [record],
      [ledger('notification:e')],
    );
    expect(state.sent.find((op) => op.kind === 'batch')).toBeTruthy();
    state.rows = [{ record_json: JSON.stringify(record) }];
    await expect(
      sqliteReadAccountNotifications('acct', 10, 100),
    ).resolves.toEqual([record]);
  });
});

function response(outcome: StorageResponse['outcome'], rows: StorageResponse['rows'] = []): StorageResponse {
  return { requestId: 'test', outcome, rows, rowsAffected: 0, diagnostics: {} };
}

function eventRow(event: StoredEvent): StorageResponse['rows'][number] {
  return {
    event_json: JSON.stringify(event),
    relay_urls_json: JSON.stringify(event.relayUrls),
  };
}

function ledger(id: string) {
  return {
    id,
    ownerKind: 'notification' as const,
    resourceKind: 'notification-record' as const,
    resourceId: id,
    score: 1,
    createdAt: 1,
    updatedAt: 1,
    cacheBytes: 1,
    protected: false,
  };
}

function storedEvent(id: string, createdAt: number, relayUrls: readonly string[]): StoredEvent {
  return {
    id,
    pubkey: 'p'.repeat(64),
    created_at: createdAt,
    kind: 1,
    tags: [],
    content: 'hello',
    sig: 's'.repeat(128),
    receivedAt: createdAt * 1000,
    relayUrls,
  };
}
