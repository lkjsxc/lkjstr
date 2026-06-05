import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageOp } from '../../../src/lib/storage/sqlite-opfs/types';
import type {
  ScanDensityModelRecord,
  ScanModelContext,
  ScanObservationRecord,
} from '../../../src/lib/feed-surface/scan-model-records';

const state = vi.hoisted(() => ({
  schemaOk: true,
  send: async (op: StorageOp) => {
    void op;
    throw new Error('storage offline');
  },
}));

vi.mock('../../../src/lib/storage/sqlite-opfs/event-schema', () => ({
  ensureEventGraphSchema: async () => state.schemaOk,
}));

vi.mock('../../../src/lib/storage/sqlite-opfs/kernel-client', () => ({
  sendSqliteStorage: (op: StorageOp) => state.send(op),
}));

const {
  insertScanDecisionTrace,
  insertScanObservation,
  selectScanModelsForContext,
  upsertScanDensityModels,
} = await import('../../../src/lib/feed-surface/scan-model-repository');

describe('scan model repository storage failures', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', function Worker() {});
    state.schemaOk = true;
    state.send = async () => {
      throw new Error('storage offline');
    };
  });

  it('returns no learned models when storage query throws', async () => {
    await expect(selectScanModelsForContext(context())).resolves.toEqual([]);
  });

  it('returns false for failed optimizer writes', async () => {
    await expect(upsertScanDensityModels([model()])).resolves.toBe(false);
    await expect(insertScanObservation(observation())).resolves.toBe(false);
    await expect(insertScanDecisionTrace(trace())).resolves.toBe(false);
  });

  it('returns unavailable when the schema is unavailable', async () => {
    state.schemaOk = false;
    await expect(
      selectScanModelsForContext(context()),
    ).resolves.toBeUndefined();
  });
});

function context(): ScanModelContext {
  return {
    semanticFeedKey: 'home:test',
    routeGroupKey: 'selected',
    relayUrl: 'wss://relay.example/',
    semanticFilterKey: 'kind:1',
    direction: 'older',
    routeFingerprint: 'route-a',
  };
}

function model(): ScanDensityModelRecord {
  return {
    ...context(),
    modelKey:
      'Exact|home:test|selected|wss://relay.example/|kind:1|older|route-a',
    scope: 'Exact',
    targetLimitFraction: '2/3',
    densityEventsPerSecond: 0.1,
    sampleWeight: 1,
    updatedAtMs: 1,
    decaysAfterMs: 2,
  };
}

function observation(): ScanObservationRecord {
  return {
    ...context(),
    id: 'observation-a',
    createdAtMs: 1,
    recordJson: { ok: true },
  };
}

function trace() {
  return {
    traceId: 'trace-a',
    modelKey: model().modelKey,
    semanticFeedKey: context().semanticFeedKey,
    direction: 'older' as const,
    createdAtMs: 1,
    recordJson: { ok: true },
  };
}
