import type { ScanModelContext, ScanModelScope } from './scan-model-records';

export const scanModelScopes: readonly ScanModelScope[] = [
  'Exact',
  'RouteGroup',
  'RelayFilter',
  'SurfaceFilter',
  'Surface',
  'Global',
];

export function scanModelKey(
  context: ScanModelContext,
  scope: ScanModelScope,
): string {
  const scoped = scopedContext(context, scope);
  return [
    scope,
    scoped.semanticFeedKey,
    scoped.routeGroupKey,
    scoped.relayUrl,
    scoped.semanticFilterKey,
    scoped.direction,
    scoped.routeFingerprint,
  ].join('|');
}

export function scopedContext(
  context: ScanModelContext,
  scope: ScanModelScope,
): ScanModelContext {
  return {
    semanticFeedKey: usesSurface(scope) ? context.semanticFeedKey : '',
    routeGroupKey: usesRoute(scope) ? context.routeGroupKey : '',
    relayUrl: usesRelay(scope) ? context.relayUrl : '',
    semanticFilterKey: usesFilter(scope) ? context.semanticFilterKey : '',
    direction: context.direction,
    routeFingerprint: scope === 'Exact' ? context.routeFingerprint : '',
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
