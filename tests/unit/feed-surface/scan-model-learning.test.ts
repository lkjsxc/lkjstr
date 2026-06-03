import { describe, expect, it } from 'vitest';
import {
  proposeScanSpanFromModels,
  updateScanModelsFromObservation,
  type ScanModelObservation,
} from '../../../src/lib/feed-surface/scan-model-learning';
import { selectMatchingScanModelsForContext } from '../../../src/lib/feed-surface/scan-model-repository';
import type { ScanModelContext } from '../../../src/lib/feed-surface/scan-model-records';

describe('scan model learning', () => {
  it('treats limit hits as density evidence instead of simple halves', () => {
    const models = updateScanModelsFromObservation({
      observation: observation({
        eventLimitReached: true,
        finalVisibleCount: 100,
      }),
      previousModels: [],
    });
    const proposal = proposeScanSpanFromModels({
      context: context(),
      models,
      effectiveLimit: 100,
      previousSpanSeconds: 600,
      nowMs: 1_000,
    });
    expect(proposal?.spanSeconds).toBeGreaterThanOrEqual(380);
    expect(proposal?.spanSeconds).toBeLessThanOrEqual(420);
  });

  it('grows sparse complete windows from density beyond two times', () => {
    const models = updateScanModelsFromObservation({
      observation: observation({ finalVisibleCount: 20 }),
      previousModels: [],
    });
    const proposal = proposeScanSpanFromModels({
      context: context(),
      models,
      effectiveLimit: 100,
      previousSpanSeconds: 600,
      nowMs: 1_000,
    });
    expect(proposal?.spanSeconds).toBeGreaterThan(1_800);
    expect(proposal?.spanSeconds).toBeLessThan(2_100);
  });

  it('caps very sparse growth to the configured change factor', () => {
    const models = updateScanModelsFromObservation({
      observation: observation({ finalVisibleCount: 1 }),
      previousModels: [],
    });
    const proposal = proposeScanSpanFromModels({
      context: context(),
      models,
      effectiveLimit: 100,
      previousSpanSeconds: 600,
      nowMs: 1_000,
    });
    expect(proposal?.spanSeconds).toBe(2_400);
    expect(proposal?.capReason).toBe('increase-limited');
  });

  it('uses parent route-group evidence when exact evidence is missing', () => {
    const parent = updateScanModelsFromObservation({
      observation: observation({ finalVisibleCount: 20 }),
      previousModels: [],
    }).find((model) => model.scope === 'RouteGroup')!;
    const selected = selectMatchingScanModelsForContext([parent], {
      ...context(),
      routeFingerprint: 'other-route',
    });
    const proposal = proposeScanSpanFromModels({
      context: context(),
      models: selected,
      effectiveLimit: 100,
      previousSpanSeconds: 600,
      nowMs: 1_000,
    });
    expect(proposal?.sourceScope).toBe('RouteGroup');
    expect(proposal?.spanSeconds).toBeGreaterThan(1_800);
  });
});

function context(): ScanModelContext {
  return {
    semanticFeedKey: 'home:pubkey:relays',
    routeGroupKey: 'selected',
    relayUrl: 'wss://relay.example/',
    semanticFilterKey: 'kind-1-authors',
    direction: 'older',
    routeFingerprint: 'route-a',
  };
}

function observation(
  overrides: Partial<ScanModelObservation> = {},
): ScanModelObservation {
  return {
    ...context(),
    sinceSeconds: 400,
    untilSeconds: 1_000,
    requestedLimit: 100,
    effectiveLimit: 100,
    eventCount: overrides.finalVisibleCount ?? 20,
    uniqueEventCount: overrides.finalVisibleCount ?? 20,
    finalVisibleCount: 20,
    eventLimitReached: false,
    eose: true,
    timeout: false,
    closed: false,
    auth: false,
    socketError: false,
    startedAtMs: 0,
    completedAtMs: 1_000,
    ...overrides,
  };
}
