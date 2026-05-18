import { browserDb } from '../storage/browser-db';

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
    rawEventCount: await browserDb().events.count(),
    profileCount: 0,
    notificationCount: await browserDb().notifications.count(),
    tweetDraftCount: await browserDb().tweetDrafts.count(),
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
