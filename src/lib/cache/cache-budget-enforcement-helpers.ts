import type { CacheBudgetSnapshot } from './cache-budget-snapshot';
import type {
  CachePressureState,
  PressureInput,
} from './cache-budget-decision';
import { deleteCacheLedgerResources } from './compaction-delete';
import type { StorageQuotaSnapshot } from './storage-quota';
import {
  deriveSiteStorageBudget,
  shouldCompactForSiteBudget,
} from './site-storage-budget';

export function adjustedQuota(
  quota: StorageQuotaSnapshot | null,
  prunedBytes: number,
): StorageQuotaSnapshot | null {
  if (!quota || prunedBytes <= 0) return quota;
  const usage = Math.max(0, quota.usage - prunedBytes);
  return { ...quota, usage, ratio: usage / quota.quota };
}

export function shouldContinueCompaction(
  snapshot: CacheBudgetSnapshot,
  quota: StorageQuotaSnapshot | null,
  budgetBytes: number,
): boolean {
  return (
    snapshot.inventoryStatus === 'exact' &&
    shouldCompactForSiteBudget(
      snapshot.prunableCacheBytes,
      deriveSiteStorageBudget(budgetBytes, quota),
    )
  );
}

export function pressureInput(input: {
  readonly snapshot: CacheBudgetSnapshot;
  readonly quota: StorageQuotaSnapshot | null;
  readonly budgetBytes: number;
  readonly eligibleRows: number;
  readonly protectedRows: number;
  readonly prunedResources: number;
}): PressureInput {
  return {
    budget: deriveSiteStorageBudget(input.budgetBytes, input.quota),
    prunableCacheBytes: input.snapshot.prunableCacheBytes,
    eligibleRows: input.eligibleRows,
    protectedRows:
      input.protectedRows + (input.snapshot.protectedUserBytes > 0 ? 1 : 0),
    unknownOrOverheadBytes: input.snapshot.unknownOrOverheadBytes,
    inventoryStatus: input.snapshot.inventoryStatus,
    prunedResources: input.prunedResources,
    storageApiAvailable: input.snapshot.storageApiAvailable,
  };
}

export function stopReason(state: CachePressureState): string {
  if (state === 'compacted-under-budget') return 'below-budget';
  return state;
}

export async function safeDeleteCacheLedgerResources(
  rows: Parameters<typeof deleteCacheLedgerResources>[0],
) {
  try {
    return await deleteCacheLedgerResources(rows);
  } catch {
    return null;
  }
}
