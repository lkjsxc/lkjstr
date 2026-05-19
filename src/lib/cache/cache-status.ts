import { browserDb } from '../storage/browser-db';
import { boundedStorageRead } from '../storage/safe-storage';

export type CacheMetadata = {
  readonly id: string;
  readonly rawEventCount: number;
  readonly profileCount: number;
  readonly notificationCount: number;
  readonly tweetDraftCount: number;
  readonly storageEstimateBytes: number | null;
  readonly updatedAt: number;
};

export async function cacheStatus(): Promise<CacheMetadata> {
  const storageEstimateBytes = await estimateStorageBytes();
  return {
    id: 'main',
    rawEventCount: await boundedStorageRead(
      () => browserDb().events.count(),
      0,
    ),
    profileCount: 0,
    notificationCount: await boundedStorageRead(
      () => browserDb().notifications.count(),
      0,
    ),
    tweetDraftCount: await boundedStorageRead(
      () => browserDb().tweetDrafts.count(),
      0,
    ),
    storageEstimateBytes,
    updatedAt: Date.now(),
  };
}

async function estimateStorageBytes(): Promise<number | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate)
    return null;
  const estimate = await navigator.storage.estimate();
  return estimate.usage ?? null;
}
