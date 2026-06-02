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

const {
  sqlitePutFeedCoverageRows,
  sqliteReadFeedCoverageRows,
  sqliteReadFeedCoverageRowsForRequirements,
  sqlitePutFeedScanHint,
  sqliteReadFeedScanHints,
  sqliteDeleteAllFeedScanHints,
} = await import('../../../src/lib/storage/sqlite-opfs/feed-cache-sqlite');

describe('SQLite feed cache repositories', () => {
  test('writes and reads feed coverage records', async () => {
    const coverage = {
      id: 'coverage:1',
      feedKey: 'home',
      relayUrl: 'wss://relay.example',
      groupKey: 'selected',
      filterKey: 'kind1',
      status: 'complete' as const,
      updatedAt: 2,
    };
    await sqlitePutFeedCoverageRows([coverage], [ledger('feed-coverage')]);
    expect(state.sent.find((op) => op.kind === 'batch')).toBeTruthy();
    state.rows = [{ record_json: JSON.stringify(coverage) }];
    await expect(sqliteReadFeedCoverageRows('home')).resolves.toEqual([
      coverage,
    ]);
  });

  test('reads exact coverage rows for proof requirements', async () => {
    state.sent = [];
    const coverage = {
      id: 'coverage:2',
      feedKey: 'home',
      relayUrl: 'wss://relay.example',
      groupKey: 'selected',
      filterKey: 'kind1',
      status: 'complete' as const,
      since: 10,
      until: 20,
      updatedAt: 2,
    };
    state.rows = [{ record_json: JSON.stringify(coverage) }];
    await expect(
      sqliteReadFeedCoverageRowsForRequirements('home', [
        {
          groupKey: 'selected',
          relayUrl: 'wss://relay.example',
          filterKey: 'kind1',
          since: 12,
          until: 18,
        },
      ]),
    ).resolves.toEqual([coverage]);
    const query = state.sent.find((op) => op.kind === 'query');
    expect(query?.kind === 'query' ? query.statement : '').toContain(
      'feed_key = ?1 AND group_key = ?2 AND relay_url = ?3',
    );
  });

  test('writes, reads, and deletes scan hints', async () => {
    state.sent = [];
    const hint = {
      id: 'scan|relay',
      scanKey: 'scan',
      relayUrl: 'wss://relay.example',
      groupKey: 'selected',
      filterKey: 'kind1',
      direction: 'older' as const,
      recommendedSpanSeconds: 60,
      lastSpanSeconds: 120,
      lastFeedback: 'balanced' as const,
      updatedAt: 3,
    };
    await sqlitePutFeedScanHint(hint, ledger('feed-scan-hint'));
    state.rows = [{ record_json: JSON.stringify(hint) }];
    await expect(
      sqliteReadFeedScanHints({ scanKey: 'scan', direction: 'older' }),
    ).resolves.toEqual([hint]);
    await sqliteDeleteAllFeedScanHints();
    expect(state.sent.some((op) => op.kind === 'batch')).toBe(true);
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
    ownerKind: 'feed-coverage' as const,
    resourceKind: 'coverage-row' as const,
    resourceId: id,
    score: 1,
    createdAt: 1,
    updatedAt: 1,
    cacheBytes: 1,
    protected: false,
  };
}
