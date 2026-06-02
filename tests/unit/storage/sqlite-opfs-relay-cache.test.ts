import { describe, expect, test, vi } from 'vitest';
import type {
  StorageOp,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';
import type { RelayRoute } from '../../../src/lib/relays/relay-route-types';

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

const {
  sqlitePutRelayListSuggestions,
  sqlitePutAuthorRelayRoutes,
  sqliteReadAuthorRelayRoutes,
} = await import('../../../src/lib/storage/sqlite-opfs/relay-cache-sqlite');

describe('SQLite relay cache repositories', () => {
  test('writes suggestions and ledger rows in one batch', async () => {
    state.sent = [];
    await sqlitePutRelayListSuggestions(
      [
        {
          id: 'p:wss://relay.example',
          accountPubkey: 'p',
          relayUrl: 'wss://relay.example',
          read: true,
          write: false,
          sourceEventId: 'e',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      [ledger('relay-suggestion:p:wss://relay.example')],
    );

    const batch = state.sent.find((op) => op.kind === 'batch');
    expect(batch?.kind === 'batch' ? batch.steps.length : 0).toBe(2);
  });

  test('reads author route records from JSON rows', async () => {
    const route: RelayRoute = {
      id: 'p:wss://relay.example:nip65',
      authorPubkey: 'p',
      relayUrl: 'wss://relay.example',
      source: 'nip65',
      purpose: 'read',
      updatedAt: 3,
    };
    state.rows = [{ record_json: JSON.stringify(route) }];
    await expect(sqliteReadAuthorRelayRoutes(['p'])).resolves.toEqual([route]);
  });

  test('writes author routes with ledger rows', async () => {
    state.sent = [];
    await sqlitePutAuthorRelayRoutes(
      [
        {
          id: 'p:wss://relay.example:nip65',
          authorPubkey: 'p',
          relayUrl: 'wss://relay.example',
          source: 'nip65',
          purpose: 'read',
          updatedAt: 3,
        },
      ],
      [ledger('route:p')],
    );
    const batch = state.sent.find((op) => op.kind === 'batch');
    expect(batch?.kind === 'batch' ? batch.steps.length : 0).toBe(2);
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
    ownerKind: 'relay-suggestion' as const,
    resourceKind: 'relay-list-suggestion' as const,
    resourceId: id,
    score: 1,
    createdAt: 1,
    updatedAt: 1,
    cacheBytes: 1,
    protected: false,
  };
}
