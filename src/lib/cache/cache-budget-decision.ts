import type { SiteStorageBudget } from './site-storage-budget';

export type CachePressureState =
  | 'below-budget'
  | 'compacted-under-budget'
  | 'no-prunable-candidates'
  | 'protected-only'
  | 'unknown-unowned-usage'
  | 'inventory-incomplete'
  | 'quota-pressure'
  | 'compaction-error'
  | 'quota-unavailable'
  | 'storage-api-unavailable';

export type InventoryScanStatus =
  | 'exact'
  | 'partial'
  | 'timeout'
  | 'unavailable'
  | 'unsupported';

export type PressureInput = {
  readonly budget: SiteStorageBudget;
  readonly prunableCacheBytes: number;
  readonly eligibleRows: number;
  readonly protectedRows: number;
  readonly unknownOrOverheadBytes: number;
  readonly inventoryStatus: InventoryScanStatus;
  readonly prunedResources: number;
  readonly storageApiAvailable: boolean;
};

export function pressureState(input: PressureInput): CachePressureState {
  if (!input.storageApiAvailable) return 'storage-api-unavailable';
  if (
    input.budget.browserUsageBytes !== null &&
    !input.budget.overSiteBudget &&
    !input.budget.quotaPressure
  )
    return input.prunedResources > 0
      ? 'compacted-under-budget'
      : 'below-budget';
  if (
    input.budget.browserUsageBytes === null &&
    input.prunableCacheBytes <= input.budget.siteBudgetBytes
  )
    return input.prunedResources > 0
      ? 'compacted-under-budget'
      : 'below-budget';
  if (input.inventoryStatus !== 'exact') return 'inventory-incomplete';
  if (input.budget.browserUsageBytes === null) return quotaFallbackState(input);
  if (input.eligibleRows > 0) return 'quota-pressure';
  if (input.unknownOrOverheadBytes > 0) return 'unknown-unowned-usage';
  if (input.protectedRows > 0 || input.prunableCacheBytes > 0)
    return 'protected-only';
  if (input.budget.quotaPressure) return 'quota-pressure';
  return input.inventoryStatus === 'exact'
    ? 'no-prunable-candidates'
    : 'inventory-incomplete';
}

export function shouldStopCompaction(input: PressureInput): boolean {
  if (
    input.storageApiAvailable &&
    input.inventoryStatus === 'exact' &&
    input.eligibleRows > 0 &&
    (input.budget.overSiteBudget ||
      input.budget.quotaPressure ||
      (input.budget.browserUsageBytes === null &&
        input.prunableCacheBytes > input.budget.siteBudgetBytes))
  )
    return false;
  const state = pressureState(input);
  return (
    state === 'below-budget' ||
    state === 'compacted-under-budget' ||
    state === 'no-prunable-candidates' ||
    state === 'protected-only' ||
    state === 'unknown-unowned-usage' ||
    state === 'inventory-incomplete' ||
    state === 'quota-pressure' ||
    state === 'compaction-error' ||
    state === 'quota-unavailable' ||
    state === 'storage-api-unavailable'
  );
}

function quotaFallbackState(input: PressureInput): CachePressureState {
  if (input.prunableCacheBytes <= input.budget.siteBudgetBytes) {
    return input.prunedResources > 0
      ? 'compacted-under-budget'
      : 'below-budget';
  }
  if (input.eligibleRows > 0) return 'quota-pressure';
  if (input.protectedRows > 0 || input.prunableCacheBytes > 0)
    return 'protected-only';
  return 'quota-unavailable';
}
