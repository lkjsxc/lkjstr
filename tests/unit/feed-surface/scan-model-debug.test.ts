import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageOp } from '../../../src/lib/storage/sqlite-opfs/types';

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  sent: [] as StorageOp[],
}));

vi.mock('../../../src/lib/storage/sqlite-opfs/event-schema', () => ({
  ensureEventGraphSchema: async () => true,
}));

vi.mock('../../../src/lib/storage/sqlite-opfs/kernel-client', () => ({
  sendSqliteStorage: async (op: StorageOp) => {
    state.sent.push(op);
    return {
      requestId: 'test',
      outcome: 'ok',
      rows: state.rows,
      rowsAffected: 0,
    };
  },
}));

vi.mock('../../../src/lib/storage/sqlite-opfs/storage-health', () => ({
  readSqliteStorageHealth: async () => ({
    status: 'available',
    health: { mode: 'temporary-memory' },
  }),
}));

vi.mock('../../../src/lib/feed-surface/scan-model-wasm', () => ({
  loadScanModelWasmPlanner: async () => ({ ok: false, message: 'test bridge' }),
}));

const { listRecentScanDecisionTraces, readScanOptimizerDebugSnapshot } =
  await import('../../../src/lib/feed-surface/scan-model-debug');

describe('scan model debug projection', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', function Worker() {});
    state.rows = [];
    state.sent = [];
  });

  it('hydrates trace identity from SQLite columns when record_json lacks it', async () => {
    state.rows = [
      traceRow('trace-a', 'model-a', '{"context":{"relayUrl":"wss://a"}}'),
      traceRow('trace-b', 'model-b', '{"context":{"relayUrl":"wss://b"}}'),
    ];

    const traces = await listRecentScanDecisionTraces();

    expect(traces.map((trace) => trace.traceId)).toEqual([
      'trace-a',
      'trace-b',
    ]);
    expect(new Set(traces.map((trace) => trace.traceId)).size).toBe(2);
    expect(traces[0]?.recordJson).toMatchObject({
      context: { relayUrl: 'wss://a' },
    });
  });

  it('returns bridge unavailable state without fake scan rows', async () => {
    const snapshot = await readScanOptimizerDebugSnapshot();

    expect(snapshot.wasmBridge).toEqual({
      state: 'unavailable',
      message: 'test bridge',
    });
    expect(snapshot.storageMode).toBe('temporary-memory');
  });
});

function traceRow(traceId: string, modelKey: string, recordJson: string) {
  return {
    trace_id: traceId,
    model_key: modelKey,
    semantic_feed_key: 'home:test',
    direction: 'older',
    created_at_ms: 100,
    record_json: recordJson,
  };
}
