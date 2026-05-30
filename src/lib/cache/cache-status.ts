import { browserDb } from '../storage/browser-db';
import { boundedStorageRead } from '../storage/safe-storage';
import { allMemoryEvents } from '../events/repository-memory';
import { defaultCacheMaxBytes, readStorageQuota } from './storage-quota';
import {
  estimatedEventCacheBytes,
  estimatedLedgerBytes,
  estimatedLedgerBytesByOwner,
  estimatedPrunableCacheBytes,
  type LedgerInventoryRow,
} from './event-cache-bytes';
import { deriveSiteStorageBudget } from './site-storage-budget';
import {
  storageInventory,
  type StorageInventoryRow,
} from '../storage/storage-inventory';

export type CacheMetadata = {
  readonly id: string;
  readonly rawEventCount: number;
  readonly profileCount: number;
  readonly notificationCount: number;
  readonly storageEstimateBytes: number | null;
  readonly budgetBytes: number;
  readonly ledgerBytes: number;
  readonly prunableCacheBytes: number;
  readonly protectedUserBytes: number;
  readonly unknownOrOverheadBytes: number;
  readonly eventCacheBytes: number;
  readonly browserUsageBytes: number | null;
  readonly lastCompactionReason?: string;
  readonly prunedEventCount: number;
  readonly prunedResourceCount: number;
  readonly prunedByteEstimate: number;
  readonly protectedOnly: boolean;
  readonly protectedOrUnknownOnly: boolean;
  readonly ledgerInventory: readonly LedgerInventoryRow[];
  readonly storageInventory: readonly StorageInventoryRow[];
  readonly updatedAt: number;
};

export async function cacheStatus(): Promise<CacheMetadata> {
  const quota = await readStorageQuota();
  const meta = await boundedStorageRead(
    () => browserDb().cacheMeta.get('main'),
    undefined,
  );
  const ledgerBytes = await estimatedLedgerBytes();
  const prunableCacheBytes = await estimatedPrunableCacheBytes();
  const eventCacheBytes = await estimatedEventCacheBytes();
  const currentBudget = deriveSiteStorageBudget(
    meta?.budgetBytes ?? defaultCacheMaxBytes,
    quota,
  );
  const inventory = await storageInventory(currentBudget.browserUsageBytes);
  const protectedUserBytes = inventory
    .filter((row) => row.group === 'protected')
    .reduce((sum, row) => sum + row.estimatedBytes, 0);
  const tableBytes = inventory
    .filter((row) => row.group !== 'overhead')
    .reduce((sum, row) => sum + row.estimatedBytes, 0);
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
    storageEstimateBytes: currentBudget.browserUsageBytes,
    budgetBytes: currentBudget.siteBudgetBytes,
    ledgerBytes,
    prunableCacheBytes,
    protectedUserBytes,
    unknownOrOverheadBytes:
      currentBudget.browserUsageBytes === null
        ? 0
        : Math.max(0, currentBudget.browserUsageBytes - tableBytes),
    eventCacheBytes,
    browserUsageBytes: currentBudget.browserUsageBytes,
    lastCompactionReason: meta?.lastCompactionReason,
    prunedEventCount: meta?.prunedEventCount ?? 0,
    prunedResourceCount: meta?.prunedResourceCount ?? 0,
    prunedByteEstimate: meta?.prunedByteEstimate ?? 0,
    protectedOnly: meta?.protectedOnly ?? false,
    protectedOrUnknownOnly: meta?.protectedOrUnknownOnly ?? false,
    ledgerInventory: await estimatedLedgerBytesByOwner(),
    storageInventory: inventory,
    updatedAt: Date.now(),
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
