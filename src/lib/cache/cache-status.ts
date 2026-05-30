import { browserDb } from '../storage/browser-db';
import { boundedStorageRead } from '../storage/safe-storage';
import { allMemoryEvents } from '../events/repository-memory';
import { defaultCacheMaxBytes, readStorageQuota } from './storage-quota';
import { estimatedEventCacheBytes } from './event-cache-bytes';
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
  readonly eventCacheTargetBytes: number;
  readonly eventCacheBytes: number;
  readonly browserUsageBytes: number | null;
  readonly lastCompactionReason?: string;
  readonly prunedEventCount: number;
  readonly prunedByteEstimate: number;
  readonly protectedOnly: boolean;
  readonly storageInventory: readonly StorageInventoryRow[];
  readonly updatedAt: number;
};

export async function cacheStatus(): Promise<CacheMetadata> {
  const quota = await readStorageQuota();
  const meta = await boundedStorageRead(
    () => browserDb().cacheMeta.get('main'),
    undefined,
  );
  const eventCacheBytes = await estimatedEventCacheBytes();
  const currentBudget = deriveSiteStorageBudget(
    eventCacheBytes,
    meta?.budgetBytes ?? defaultCacheMaxBytes,
    quota,
  );
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
    eventCacheTargetBytes: currentBudget.eventCacheTargetBytes,
    eventCacheBytes,
    browserUsageBytes: currentBudget.browserUsageBytes,
    lastCompactionReason: meta?.lastCompactionReason,
    prunedEventCount: meta?.prunedEventCount ?? 0,
    prunedByteEstimate: meta?.prunedByteEstimate ?? 0,
    protectedOnly: meta?.protectedOnly ?? false,
    storageInventory: await storageInventory(currentBudget.browserUsageBytes),
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
