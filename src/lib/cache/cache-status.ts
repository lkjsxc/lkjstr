import { browserDb } from '../storage/browser-db';
import { boundedStorageRead } from '../storage/safe-storage';
import { allMemoryEvents } from '../events/repository-memory';
import { defaultCacheMaxBytes } from './storage-quota';
import { estimatedEventCacheBytes } from './event-cache-bytes';

export type CacheMetadata = {
  readonly id: string;
  readonly rawEventCount: number;
  readonly profileCount: number;
  readonly notificationCount: number;
  readonly storageEstimateBytes: number | null;
  readonly budgetBytes: number;
  readonly eventCacheBytes: number;
  readonly browserUsageBytes: number | null;
  readonly lastCompactionReason?: string;
  readonly prunedEventCount: number;
  readonly prunedByteEstimate: number;
  readonly protectedOnly: boolean;
  readonly updatedAt: number;
};

export async function cacheStatus(): Promise<CacheMetadata> {
  const storageEstimateBytes = await estimateStorageBytes();
  const meta = await boundedStorageRead(
    () => browserDb().cacheMeta.get('main'),
    undefined,
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
    storageEstimateBytes,
    budgetBytes: meta?.budgetBytes ?? defaultCacheMaxBytes,
    eventCacheBytes: await estimatedEventCacheBytes(),
    browserUsageBytes: storageEstimateBytes,
    lastCompactionReason: meta?.lastCompactionReason,
    prunedEventCount: meta?.prunedEventCount ?? 0,
    prunedByteEstimate: meta?.prunedByteEstimate ?? 0,
    protectedOnly: meta?.protectedOnly ?? false,
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

async function estimateStorageBytes(): Promise<number | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate)
    return null;
  const estimate = await navigator.storage.estimate();
  return estimate.usage ?? null;
}
