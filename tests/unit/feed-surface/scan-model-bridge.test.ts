import { describe, expect, it } from 'vitest';
import {
  planScanSpanWithRust,
  reduceScanObservationWithRust,
} from '../../../src/lib/feed-surface/scan-model-bridge';
import {
  modelRecordFromRust,
  proposalFromRust,
} from '../../../src/lib/feed-surface/scan-model-dto';
import type { ScanModelContext } from '../../../src/lib/feed-surface/scan-model-records';
import { createScanModelWasmPlanner } from '../../../src/lib/feed-surface/scan-model-wasm';

describe('scan model Rust bridge host', () => {
  it('reports explicit unavailable state in the unit test host', async () => {
    const result = await planScanSpanWithRust({
      context: context(),
      models: [],
      effectiveLimit: 100,
      requestedLimit: 100,
      pageSize: 100,
      edgeSeconds: 1_000,
      edgeId: 'edge',
      nowMs: 1_000_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unavailable');
      expect(result.message).toContain('unavailable');
    }
  });

  it('rejects invalid plan input before loading the bridge', async () => {
    const result = await planScanSpanWithRust({
      context: context(),
      models: [],
      effectiveLimit: 0,
      requestedLimit: 100,
      pageSize: 100,
      edgeSeconds: 1_000,
      edgeId: 'edge',
      nowMs: 1_000_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-input');
  });

  it('rejects invalid observations before loading the bridge', async () => {
    const result = await reduceScanObservationWithRust({
      plan: {
        context: context(),
        models: [],
        effectiveLimit: 100,
        requestedLimit: 100,
        pageSize: 100,
        edgeSeconds: 1_000,
        edgeId: 'edge',
        nowMs: 1_000_000,
      },
      observation: {
        ...context(),
        sinceSeconds: 20,
        untilSeconds: 10,
        requestedLimit: 100,
        effectiveLimit: 100,
        eventCount: 0,
        uniqueEventCount: 0,
        finalVisibleCount: 0,
        eventLimitReached: false,
        eose: true,
        timeout: false,
        closed: false,
        auth: false,
        socketError: false,
        startedAtMs: 1,
        completedAtMs: 2,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-input');
  });

  it('classifies throwing bridge exports as invalid input', () => {
    const planner = createScanModelWasmPlanner({
      plan_feed_scan_from_js: () => {
        throw new Error('bad dto');
      },
    });

    const result = planner.plan<unknown>({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-input');
      expect(result.message).toContain('bad dto');
    }
  });

  it('maps Rust model DTOs to stable parent model records', () => {
    const record = modelRecordFromRust({
      semantic_feed_key: 'home:key',
      route_group_key: 'selected',
      relay_url: '',
      semantic_filter_key: '',
      direction: 'older',
      route_fingerprint: '',
      scope: 'RouteGroup',
      density_events_per_second: 0.1,
      log_density_mean: Math.log(0.1),
      log_density_variance: 0,
      sample_weight: 1,
      complete_window_count: 1,
      dense_window_count: 0,
      sparse_window_count: 1,
      incomplete_window_count: 0,
      failure_window_count: 0,
      limit_hit_rate: 0,
      incomplete_rate: 0,
      last_good_span_seconds: 600,
      last_proposed_span_seconds: 600,
      updated_at_ms: 10,
    });
    expect(record.scope).toBe('RouteGroup');
    expect(record.routeFingerprint).toBe('');
    expect(record.modelKey).toBe('RouteGroup|home:key|selected|||older|');
  });

  it('maps Rust proposal diagnostics to Stats-ready proposal records', () => {
    const proposal = proposalFromRust(
      {
        span_seconds: 400,
        target_count: 66,
        effective_limit: 100,
        estimated_density_events_per_second: 0.166,
        source_scope: 'Exact',
        confidence: 0.8,
        cap_applied: 'decrease-limited',
        diagnostics: ['dense evidence'],
      },
      context(),
    );
    expect(proposal.spanSeconds).toBe(400);
    expect(proposal.sourceModelKey).toContain('Exact|home:key');
    expect(proposal.capReason).toBe('decrease-limited');
  });
});

function context(): ScanModelContext {
  return {
    semanticFeedKey: 'home:key',
    routeGroupKey: 'selected',
    relayUrl: 'wss://relay.example/',
    semanticFilterKey: 'kind:1',
    direction: 'older',
    routeFingerprint: 'route-a',
  };
}
