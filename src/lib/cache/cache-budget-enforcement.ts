import { indexedDbAvailable } from '../storage/safe-storage';
import {
  cacheBudgetResult,
  type CacheBudgetResult,
} from './cache-budget-result';
import { pressureState, shouldStopCompaction } from './cache-budget-decision';
import { writeCacheBudgetMetadata } from './cache-budget-metadata';
import { cacheBudgetSnapshot } from './cache-budget-snapshot';
import { deleteCacheLedgerResources } from './compaction-delete';
import { protectedEventIds } from './compaction-protection';
import { lowestScorePruneSelection } from './compaction-select';
import {
  defaultCacheMaxBytes,
  quotaPruneBatchSize,
  readStorageQuota,
  type StorageQuotaSnapshot,
} from './storage-quota';
import {
  deriveSiteStorageBudget,
  shouldCompactForSiteBudget,
} from './site-storage-budget';

export type { CacheBudgetResult } from './cache-budget-result';

export type CacheBudgetReason =
  | 'startup'
  | 'write'
  | 'settings-change'
  | 'manual'
  | 'quota-pressure';

export type CacheBudgetOptions = {
  readonly maxBytes?: number;
};

export async function enforceCacheBudget(
  reason: CacheBudgetReason,
  options: CacheBudgetOptions = {},
): Promise<CacheBudgetResult> {
  const budgetBytes = options.maxBytes ?? defaultCacheMaxBytes;
  if (!indexedDbAvailable())
    return cacheBudgetResult({
      reason,
      budgetBytes,
      ledgerBytes: 0,
      prunableCacheBytes: 0,
      protectedUserBytes: 0,
      unknownOrOverheadBytes: 0,
      browserUsageBytes: null,
      prunedEvents: 0,
      prunedResources: 0,
      prunedBytes: 0,
      eventCacheBytes: 0,
      skipped: true,
      protectedOnly: true,
      pressureState: 'storage-api-unavailable',
    });
  let quota = await readStorageQuota();
  let snapshot = await cacheBudgetSnapshot(budgetBytes, quota);
  const budget = deriveSiteStorageBudget(budgetBytes, quota);
  if (!shouldCompactForSiteBudget(snapshot.prunableCacheBytes, budget)) {
    const done = cacheBudgetResult({
      reason: 'below-budget-threshold',
      budgetBytes: snapshot.siteBudgetBytes,
      ledgerBytes: snapshot.ledgerBytes,
      prunableCacheBytes: snapshot.prunableCacheBytes,
      protectedUserBytes: snapshot.protectedUserBytes,
      unknownOrOverheadBytes: snapshot.unknownOrOverheadBytes,
      browserUsageBytes: budget.browserUsageBytes,
      prunedEvents: 0,
      prunedResources: 0,
      prunedBytes: 0,
      eventCacheBytes: snapshot.eventCacheBytes,
      skipped: false,
      protectedOnly: false,
      pressureState: 'below-budget',
    });
    await writeCacheBudgetMetadata(done, snapshot);
    return done;
  }
  let prunedEvents = 0;
  let prunedResources = 0;
  let prunedBytes = 0;
  let skippedDurablyProtected = 0;
  let skippedDynamicallyProtected = 0;
  while (
    shouldCompactForSiteBudget(
      snapshot.prunableCacheBytes,
      deriveSiteStorageBudget(budgetBytes, quota),
    )
  ) {
    const protectedIds = await protectedEventIds();
    const selection = await lowestScorePruneSelection(
      quotaPruneBatchSize,
      protectedIds,
    );
    skippedDurablyProtected += selection.skippedDurablyProtected;
    skippedDynamicallyProtected += selection.skippedDynamicallyProtected;
    if (
      selection.selectedRows.length === 0 ||
      shouldStopCompaction({
        budget: deriveSiteStorageBudget(budgetBytes, quota),
        prunableCacheBytes: snapshot.prunableCacheBytes,
        eligibleRows: selection.selectedRows.length,
        protectedRows:
          selection.skippedDurablyProtected +
          selection.skippedDynamicallyProtected,
        unknownOrOverheadBytes: snapshot.unknownOrOverheadBytes,
        inventoryStatus: snapshot.inventoryStatus,
        prunedResources,
        storageApiAvailable: snapshot.storageApiAvailable,
      })
    )
      break;
    const deleted = await deleteCacheLedgerResources(selection.selectedRows);
    prunedEvents += deleted.prunedEvents;
    prunedResources += deleted.prunedResources;
    prunedBytes += deleted.prunedBytes;
    quota =
      (await readStorageQuota()) ?? adjustedQuota(quota, deleted.prunedBytes);
    snapshot = await cacheBudgetSnapshot(budgetBytes, quota);
  }
  const finalSelection = await lowestScorePruneSelection(
    1,
    await protectedEventIds(),
  );
  const finalState = pressureState({
    budget: deriveSiteStorageBudget(budgetBytes, quota),
    prunableCacheBytes: snapshot.prunableCacheBytes,
    eligibleRows: finalSelection.selectedRows.length,
    protectedRows:
      finalSelection.skippedDurablyProtected +
      finalSelection.skippedDynamicallyProtected,
    unknownOrOverheadBytes: snapshot.unknownOrOverheadBytes,
    inventoryStatus: snapshot.inventoryStatus,
    prunedResources,
    storageApiAvailable: snapshot.storageApiAvailable,
  });
  const done = cacheBudgetResult({
    reason: finalReason(reason, finalState),
    budgetBytes: snapshot.siteBudgetBytes,
    ledgerBytes: snapshot.ledgerBytes,
    prunableCacheBytes: snapshot.prunableCacheBytes,
    protectedUserBytes: snapshot.protectedUserBytes,
    unknownOrOverheadBytes: snapshot.unknownOrOverheadBytes,
    browserUsageBytes: snapshot.browserUsageBytes,
    prunedEvents,
    prunedResources,
    prunedBytes,
    eventCacheBytes: snapshot.eventCacheBytes,
    skipped: false,
    protectedOnly: finalState === 'protected-only',
    pressureState: finalState,
    skippedDurablyProtected:
      skippedDurablyProtected + finalSelection.skippedDurablyProtected,
    skippedDynamicallyProtected:
      skippedDynamicallyProtected + finalSelection.skippedDynamicallyProtected,
  });
  await writeCacheBudgetMetadata(done, snapshot);
  return done;
}

export function shouldCompact(
  prunableCacheBytes: number,
  maxBytes: number,
  quota: StorageQuotaSnapshot | null,
): boolean {
  return shouldCompactForSiteBudget(
    prunableCacheBytes,
    deriveSiteStorageBudget(maxBytes, quota),
  );
}

function adjustedQuota(
  quota: StorageQuotaSnapshot | null,
  prunedBytes: number,
): StorageQuotaSnapshot | null {
  if (!quota || prunedBytes <= 0) return quota;
  const usage = Math.max(0, quota.usage - prunedBytes);
  return { ...quota, usage, ratio: usage / quota.quota };
}

function finalReason(
  requested: CacheBudgetReason,
  state: CacheBudgetResult['pressureState'],
): string {
  if (state === 'protected-only') return 'protected-only';
  if (state === 'unknown-only') return 'protected-or-unknown-usage';
  if (state === 'inventory-incomplete') return 'inventory-incomplete';
  if (state === 'below-budget') return 'below-budget-threshold';
  return requested;
}
