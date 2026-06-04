import { describe, expect, it } from 'vitest';
import { selectMatchingScanModelsForContext } from '../../../src/lib/feed-surface/scan-model-repository';
import type {
  ScanDensityModelRecord,
  ScanModelContext,
  ScanModelScope,
} from '../../../src/lib/feed-surface/scan-model-records';

describe('scan model repository matching', () => {
  it('requires matching route fingerprint for exact scope', () => {
    const rows = [model('Exact', { routeFingerprint: 'other-route' })];
    expect(selectMatchingScanModelsForContext(rows, context())).toEqual([]);
  });

  it('accepts exact scope when route fingerprint matches', () => {
    const rows = [model('Exact')];
    expect(selectMatchingScanModelsForContext(rows, context())).toHaveLength(1);
  });

  it.each([
    'RouteGroup',
    'RelayFilter',
    'SurfaceFilter',
    'Surface',
    'Global',
  ] as const)('ignores route fingerprint for %s scope', (scope) => {
    const rows = [model(scope, { routeFingerprint: 'other-route' })];
    expect(selectMatchingScanModelsForContext(rows, context())).toHaveLength(1);
  });

  it('orders matching rows by fallback scope', () => {
    const rows = [model('Surface'), model('RelayFilter'), model('Exact')];
    expect(
      selectMatchingScanModelsForContext(rows, context()).map(
        (row) => row.scope,
      ),
    ).toEqual(['Exact', 'RelayFilter', 'Surface']);
  });

  it('orders equal scopes by model key', () => {
    const rows = [
      model('Surface', { modelKey: 'surface:b' }),
      model('Surface', { modelKey: 'surface:a' }),
    ];
    expect(
      selectMatchingScanModelsForContext(rows, context()).map(
        (row) => row.modelKey,
      ),
    ).toEqual(['surface:a', 'surface:b']);
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

function model(
  scope: ScanModelScope,
  overrides: Partial<ScanDensityModelRecord> = {},
): ScanDensityModelRecord {
  const base = context();
  return {
    ...base,
    ...scopeFields(scope, base),
    modelKey: `model:${scope}:${overrides.routeFingerprint ?? base.routeFingerprint}`,
    scope,
    targetLimitFraction: '2/3',
    densityEventsPerSecond: 0.1,
    sampleWeight: 1,
    updatedAtMs: 1,
    decaysAfterMs: 2,
    ...overrides,
  };
}

function scopeFields(
  scope: ScanModelScope,
  base: ScanModelContext,
): Pick<
  ScanDensityModelRecord,
  | 'semanticFeedKey'
  | 'routeGroupKey'
  | 'relayUrl'
  | 'semanticFilterKey'
  | 'routeFingerprint'
> {
  return {
    semanticFeedKey: usesSurface(scope) ? base.semanticFeedKey : '',
    routeGroupKey: usesRoute(scope) ? base.routeGroupKey : '',
    relayUrl: usesRelay(scope) ? base.relayUrl : '',
    semanticFilterKey: usesFilter(scope) ? base.semanticFilterKey : '',
    routeFingerprint: scope === 'Exact' ? base.routeFingerprint : '',
  };
}

const usesSurface = (scope: ScanModelScope) =>
  ['Exact', 'RouteGroup', 'SurfaceFilter', 'Surface'].includes(scope);
const usesRoute = (scope: ScanModelScope) =>
  ['Exact', 'RouteGroup'].includes(scope);
const usesRelay = (scope: ScanModelScope) =>
  ['Exact', 'RelayFilter'].includes(scope);
const usesFilter = (scope: ScanModelScope) =>
  ['Exact', 'RelayFilter', 'SurfaceFilter'].includes(scope);
