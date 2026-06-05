import type {
  ScanDensityModelRecord,
  ScanModelContext,
  ScanModelScope,
} from './scan-model-records';

export function selectMatchingScanModelsForContext(
  rows: readonly ScanDensityModelRecord[],
  context: ScanModelContext,
): ScanDensityModelRecord[] {
  return rows.filter((row) => modelMatches(row, context)).toSorted(scopeSort);
}

function modelMatches(
  row: ScanDensityModelRecord,
  context: ScanModelContext,
): boolean {
  return (
    row.direction === context.direction &&
    matches(
      scopeUsesSurface(row.scope),
      row.semanticFeedKey,
      context.semanticFeedKey,
    ) &&
    matches(
      scopeUsesRoute(row.scope),
      row.routeGroupKey,
      context.routeGroupKey,
    ) &&
    matches(scopeUsesRelay(row.scope), row.relayUrl, context.relayUrl) &&
    matches(
      scopeUsesFilter(row.scope),
      row.semanticFilterKey,
      context.semanticFilterKey,
    ) &&
    matches(
      scopeUsesRouteFingerprint(row.scope),
      row.routeFingerprint,
      context.routeFingerprint,
    )
  );
}

function matches(used: boolean, left: string, right: string): boolean {
  return !used || left === right;
}

function scopeSort(a: ScanDensityModelRecord, b: ScanDensityModelRecord) {
  return (
    scopeRank(a.scope) - scopeRank(b.scope) ||
    a.modelKey.localeCompare(b.modelKey)
  );
}

function scopeRank(scope: ScanModelScope): number {
  return [
    'Exact',
    'RouteGroup',
    'RelayFilter',
    'SurfaceFilter',
    'Surface',
    'Global',
    'Neutral',
  ].indexOf(scope);
}

const scopeUsesSurface = (scope: ScanModelScope) =>
  ['Exact', 'RouteGroup', 'SurfaceFilter', 'Surface'].includes(scope);
const scopeUsesRoute = (scope: ScanModelScope) =>
  ['Exact', 'RouteGroup'].includes(scope);
const scopeUsesRelay = (scope: ScanModelScope) =>
  ['Exact', 'RelayFilter'].includes(scope);
const scopeUsesFilter = (scope: ScanModelScope) =>
  ['Exact', 'RelayFilter', 'SurfaceFilter'].includes(scope);
const scopeUsesRouteFingerprint = (scope: ScanModelScope) => scope === 'Exact';
