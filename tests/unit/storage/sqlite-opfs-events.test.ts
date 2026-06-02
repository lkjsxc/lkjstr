import { describe, expect, test, vi } from 'vitest';
import type {
  StorageOp,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';
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
      sqliteIndexedPage({ kind: 'global', kinds: [1], limit: 10 }, 10),
    ).resolves.toHaveLength(1);
    const query = state.sent.find((op) => op.kind === 'query');
    expect(query?.kind === 'query' ? query.statement : '').toContain(
      'ORDER BY e.created_at DESC, e.id DESC',
    );
  });
});

function response(
  outcome: StorageResponse['outcome'],
  rows: StorageResponse['rows'] = [],
): StorageResponse {
  return { requestId: 'test', outcome, rows, rowsAffected: 0, diagnostics: {} };
}

function eventRow(event: StoredEvent): StorageResponse['rows'][number] {
  return {
    event_json: JSON.stringify(event),
    relay_urls_json: JSON.stringify(event.relayUrls),
  };
}

function storedEvent(
  id: string,
  createdAt: number,
  relayUrls: readonly string[],
): StoredEvent {
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
