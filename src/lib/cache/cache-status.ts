import { browserDb } from '../storage/browser-db';
import { boundedStorageRead } from '../storage/safe-storage';
import { allMemoryEvents } from '../events/repository-memory';
import { defaultCacheMaxBytes, readStorageQuota } from './storage-quota';
import type { LedgerInventoryRow } from './cache-ledger-stats';
import { cacheBudgetSnapshot } from './cache-budget-snapshot';
import type { StorageInventoryRow } from '../storage/storage-inventory';
import type {
  CachePressureState,
  InventoryScanStatus,
} from './cache-budget-decision';
import {
  cacheLedgerHealth,
  type CacheLedgerRepairResult,
} from './cache-ledger-repair';
import { storageOperationSnapshots } from '../storage/operation/tracked-operation';

export type StorageOperationSummary = {
  readonly active: number;
  readonly returnedTimeout: number;
  readonly lateSettled: number;
  readonly lateRejected: number;
};

export type CacheMetadata = {
  readonly id: string;
  readonly rawEventCount: number;
  readonly profileCount: number;
  readonly notificationCount: number;
  readonly storageEstimateBytes: number | null;
  readonly budgetBytes: number;
  readonly ledgerBytes: number;
  readonly prunableCacheBytes: number;
  readonly protectedLedgerBytes: number;
  readonly protectedUserBytes: number;
  readonly tableEstimatedBytes: number;
  readonly localStorageBytes: number;
  readonly cacheStorageBytes: number;
  readonly unknownOrOverheadBytes: number;
  readonly eventCacheBytes: number;
  readonly browserUsageBytes: number | null;
  readonly overTargetBytes: number;
  readonly inventoryStatus: InventoryScanStatus;
  readonly pressureState: CachePressureState;
  readonly totalLedgerRows: number;
  readonly prunableLedgerRows: number;
  readonly protectedLedgerRows: number;
  readonly orphanLedgerRows: number;
  readonly missingLedgerRows: number;
  readonly lastRepairResult?: CacheLedgerRepairResult;
  readonly lastCompactionReason?: string;
  readonly prunedEventCount: number;
  readonly prunedResourceCount: number;
  readonly prunedByteEstimate: number;
  readonly skippedDurablyProtected: number;
  readonly skippedDynamicallyProtected: number;
  readonly protectedOnly: boolean;
  readonly protectedOrUnknownOnly: boolean;
  readonly ledgerInventory: readonly LedgerInventoryRow[];
  readonly storageInventory: readonly StorageInventoryRow[];
  readonly storageOperations: StorageOperationSummary;
  readonly updatedAt: number;
};

export async function cacheStatus(): Promise<CacheMetadata> {
  const quota = await readStorageQuota();
  const meta = await boundedStorageRead(
    () => browserDb().cacheMeta.get('main'),
    undefined,
  );
  const snapshot = await cacheBudgetSnapshot(
    meta?.budgetBytes ?? defaultCacheMaxBytes,
    quota,
  );
  const health = await cacheLedgerHealth();
  return {
    id: 'main',
    rawEventCount: await boundedStorageRead(
      () => browserDb().events.count(),
      0,
    ),
    profileCount: await profileCount(),
    notificationCount: await boundedStorageRead(
      () => browserDb().notifications.count(),
      0,
    ),
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
    inventoryStatus: snapshot.inventoryStatus,
    pressureState: meta?.pressureState ?? 'below-budget',
    totalLedgerRows: snapshot.totalLedgerRows,
    prunableLedgerRows: snapshot.prunableLedgerRows,
    protectedLedgerRows: snapshot.protectedLedgerRows,
    orphanLedgerRows: health.orphanLedgerRows,
    missingLedgerRows: health.missingLedgerRows,
    lastRepairResult: meta?.lastRepairResult,
    lastCompactionReason: meta?.lastCompactionReason,
    prunedEventCount: meta?.prunedEventCount ?? 0,
    prunedResourceCount: meta?.prunedResourceCount ?? 0,
    prunedByteEstimate: meta?.prunedByteEstimate ?? 0,
    skippedDurablyProtected: meta?.skippedDurablyProtected ?? 0,
    skippedDynamicallyProtected: meta?.skippedDynamicallyProtected ?? 0,
    protectedOnly: meta?.protectedOnly ?? false,
    protectedOrUnknownOnly: meta?.protectedOrUnknownOnly ?? false,
    ledgerInventory: snapshot.ledgerInventory,
    storageInventory: snapshot.storageInventory,
    storageOperations: storageOperationSummary(),
    updatedAt: Date.now(),
  };
}

function storageOperationSummary(): StorageOperationSummary {
  const snapshots = storageOperationSnapshots();
  return {
    active: snapshots.filter((row) => row.status === 'active').length,
    returnedTimeout: snapshots.filter(
      (row) => row.status === 'returned-timeout',
    ).length,
    lateSettled: snapshots.filter(
      (row) =>
        row.status === 'settled-ok' && row.lateSettlementMs !== undefined,
    ).length,
    lateRejected: snapshots.filter(
      (row) =>
        row.status === 'settled-error' && row.lateSettlementMs !== undefined,
    ).length,
  };
}

async function profileCount(): Promise<number> {
  const fallback = uniqueProfilePubkeys(allMemoryEvents());
  return boundedStorageRead(async () => {
    const pubkeys = new Set<string>();
    await browserDb()
      .events.where('kind')
      .equals(0)
      .each((event) => pubkeys.add(event.pubkey));
    return pubkeys.size;
  }, fallback);
}

function uniqueProfilePubkeys(
  events: readonly { pubkey: string; kind?: number }[],
): number {
  return new Set(
    events
      .filter((event) => 'kind' in event && event.kind === 0)
      .map((event) => event.pubkey),
  ).size;
}
