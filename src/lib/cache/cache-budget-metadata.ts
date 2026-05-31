import { browserDb } from '../storage/browser-db';
import type { CacheMetadata } from './cache-status';
import type { CacheBudgetResult } from './cache-budget-result';
import type { CacheBudgetSnapshot } from './cache-budget-snapshot';

export async function writeCacheBudgetMetadata(
  result: CacheBudgetResult,
  snapshot: CacheBudgetSnapshot,
): Promise<void> {
  const meta: CacheMetadata = {
    id: 'main',
    rawEventCount: await browserDb().events.count(),
    profileCount: 0,
    notificationCount: await browserDb().notifications.count(),
    storageEstimateBytes: snapshot.browserUsageBytes,
    budgetBytes: snapshot.siteBudgetBytes,
    ledgerBytes: snapshot.ledgerBytes,
    prunableCacheBytes: snapshot.prunableCacheBytes,
    protectedLedgerBytes: snapshot.protectedLedgerBytes,
    protectedUserBytes: snapshot.protectedUserBytes,
    tableEstimatedBytes: snapshot.tableEstimatedBytes,
    localStorageBytes: snapshot.localStorageBytes,
    cacheStorageBytes: snapshot.cacheStorageBytes,
    unknownOrOverheadBytes: snapshot.unknownOrOverheadBytes,
    eventCacheBytes: snapshot.eventCacheBytes,
    browserUsageBytes: snapshot.browserUsageBytes,
    overTargetBytes: snapshot.overTargetBytes,
    indexedDbEstimatedBytes: snapshot.indexedDbEstimatedBytes,
    knownAppManagedCacheBytes: snapshot.knownAppManagedCacheBytes,
    derivedFeedCacheBytes: snapshot.derivedFeedCacheBytes,
    diagnosticsCacheBytes: snapshot.diagnosticsCacheBytes,
    ledgerStoreBytes: snapshot.ledgerStoreBytes,
    metadataBytes: snapshot.metadataBytes,
    unknownLegacyOrUnownedBytes: snapshot.unknownLegacyOrUnownedBytes,
    residualBrowserOverheadBytes: snapshot.residualBrowserOverheadBytes,
    inventoryStatus: snapshot.inventoryStatus,
    pressureState: result.pressureState,
    totalLedgerRows: snapshot.totalLedgerRows,
    prunableLedgerRows: snapshot.prunableLedgerRows,
    protectedLedgerRows: snapshot.protectedLedgerRows,
    orphanLedgerRows: result.orphanLedgerRows,
    missingLedgerRows: result.missingLedgerRows,
    lastRepairResult: result.lastRepairResult,
    lastCompactionReason: result.reason,
    prunedEventCount: result.prunedEvents,
    prunedResourceCount: result.prunedResources,
    prunedByteEstimate: result.prunedBytes,
    skippedDurablyProtected: result.skippedDurablyProtected,
    skippedDynamicallyProtected: result.skippedDynamicallyProtected,
    protectedOnly: result.protectedOnly,
    protectedOrUnknownOnly:
      result.pressureState === 'protected-only' ||
      result.pressureState === 'unknown-unowned-usage',
    ledgerInventory: snapshot.ledgerInventory,
    storageInventory: snapshot.storageInventory,
    storageOperations: {
      active: 0,
      returnedTimeout: 0,
      lateSettled: 0,
      lateRejected: 0,
    },
    updatedAt: Date.now(),
  };
  await browserDb().cacheMeta.put(meta);
}
