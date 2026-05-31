import { indexedDbAvailable } from '../storage/safe-storage';
import {
  cacheBudgetResult,
  type CacheBudgetResult,
} from './cache-budget-result';
import { pressureState, shouldStopCompaction } from './cache-budget-decision';
import {
  adjustedQuota,
  pressureInput,
  safeDeleteCacheLedgerResources,
  shouldContinueCompaction,
  stopReason,
} from './cache-budget-enforcement-helpers';
import { writeCacheBudgetMetadata } from './cache-budget-metadata';
import { cacheBudgetSnapshot } from './cache-budget-snapshot';
import { protectionSnapshot } from './compaction-protection';
import {
  emptyPruneSelection,
  lowestScorePruneSelection,
} from './compaction-select';
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
  const initialState = pressureState(
    pressureInput({
      snapshot,
      quota,
      budgetBytes,
      eligibleRows: 0,
      protectedRows: snapshot.protectedLedgerRows,
      prunedResources: 0,
    }),
  );
  if (!shouldContinueCompaction(snapshot, quota, budgetBytes)) {
    const done = cacheBudgetResult({
      reason: stopReason(initialState),
      budgetBytes: snapshot.siteBudgetBytes,
      ledgerBytes: snapshot.ledgerBytes,
      prunableCacheBytes: snapshot.prunableCacheBytes,
      protectedUserBytes: snapshot.protectedUserBytes,
      unknownOrOverheadBytes: snapshot.unknownOrOverheadBytes,
      browserUsageBytes: snapshot.browserUsageBytes,
      prunedEvents: 0,
      prunedResources: 0,
      prunedBytes: 0,
      eventCacheBytes: snapshot.eventCacheBytes,
      skipped: false,
      protectedOnly: initialState === 'protected-only',
      pressureState: initialState,
    });
    await writeCacheBudgetMetadata(done, snapshot);
    return done;
  }
  let prunedEvents = 0;
  let prunedResources = 0;
  let prunedBytes = 0;
  let skippedDurablyProtected = 0;
  let skippedDynamicallyProtected = 0;
  let compactionError = false;
  while (shouldContinueCompaction(snapshot, quota, budgetBytes)) {
    const protection = await protectionSnapshot();
    if (!protection.complete) break;
    const selection = await lowestScorePruneSelection(
      quotaPruneBatchSize,
      protection.ids,
    );
    skippedDurablyProtected += selection.skippedDurablyProtected;
    skippedDynamicallyProtected += selection.skippedDynamicallyProtected;
    if (
      selection.selectedRows.length === 0 ||
      shouldStopCompaction({
        ...pressureInput({
          snapshot,
          quota,
          budgetBytes,
          eligibleRows: selection.selectedRows.length,
          prunedResources,
          protectedRows:
            selection.skippedDurablyProtected +
            selection.skippedDynamicallyProtected,
        }),
      })
    )
      break;
    const deleted = await safeDeleteCacheLedgerResources(
      selection.selectedRows,
    );
    if (!deleted) {
      compactionError = true;
      break;
    }
    prunedEvents += deleted.prunedEvents;
    prunedResources += deleted.prunedResources;
    prunedBytes += deleted.prunedBytes;
    quota =
      (await readStorageQuota()) ?? adjustedQuota(quota, deleted.prunedBytes);
    snapshot = await cacheBudgetSnapshot(budgetBytes, quota);
  }
  const finalProtection = await protectionSnapshot();
  const finalSelection = finalProtection.complete
    ? await lowestScorePruneSelection(1, finalProtection.ids)
    : emptyPruneSelection();
  const finalState = finalProtection.complete
    ? pressureState(
        pressureInput({
          snapshot,
          quota,
          budgetBytes,
          eligibleRows: finalSelection.selectedRows.length,
          prunedResources,
          protectedRows:
            finalSelection.skippedDurablyProtected +
            finalSelection.skippedDynamicallyProtected,
        }),
      )
    : 'inventory-incomplete';
  const pressure = compactionError ? 'compaction-error' : finalState;
  const done = cacheBudgetResult({
    reason: stopReason(pressure),
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
    protectedOnly: pressure === 'protected-only',
    pressureState: pressure,
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
