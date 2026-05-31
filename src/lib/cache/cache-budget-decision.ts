import type { SiteStorageBudget } from './site-storage-budget';

export type CachePressureState =
  | 'below-budget'
  | 'compacted-under-budget'
  | 'candidate-limited'
  | 'protected-only'
  | 'unknown-only'
  | 'inventory-incomplete'
  | 'quota-unavailable'
  | 'storage-api-unavailable';

export type InventoryScanStatus =
  | 'exact'
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
  if (input.inventoryStatus === 'timeout') return 'inventory-incomplete';
  if (input.budget.browserUsageBytes === null) return quotaFallbackState(input);
  if (!input.budget.overSiteBudget)
    return input.prunedResources > 0
      ? 'compacted-under-budget'
      : 'below-budget';
  if (input.eligibleRows > 0) return 'candidate-limited';
  if (input.protectedRows > 0 || input.prunableCacheBytes > 0)
    return 'protected-only';
  if (input.unknownOrOverheadBytes > 0) return 'unknown-only';
  return input.inventoryStatus === 'exact'
    ? 'protected-only'
    : 'inventory-incomplete';
}

export function shouldStopCompaction(input: PressureInput): boolean {
  const state = pressureState(input);
  return (
    state === 'below-budget' ||
    state === 'compacted-under-budget' ||
    state === 'protected-only' ||
    state === 'unknown-only' ||
    state === 'inventory-incomplete' ||
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
  if (input.eligibleRows > 0) return 'candidate-limited';
  if (input.protectedRows > 0 || input.prunableCacheBytes > 0)
    return 'protected-only';
  return 'quota-unavailable';
}
