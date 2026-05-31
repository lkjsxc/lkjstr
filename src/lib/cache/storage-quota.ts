export type StorageQuotaSnapshot = {
  readonly usage: number;
  readonly quota: number;
  readonly ratio: number;
};

export const quotaPressureRatio = 0.9;

export const quotaPruneBatchSize = 500;

export const defaultCacheMaxBytes = 67_108_864;

export async function readStorageQuota(): Promise<StorageQuotaSnapshot | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate)
    return null;
  const estimate = await navigator.storage.estimate().catch(() => null);
  if (!estimate) return null;
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  if (quota <= 0) return null;
  return { usage, quota, ratio: usage / quota };
}

export function isQuotaPressure(
  snapshot: StorageQuotaSnapshot | null,
): boolean {
  return snapshot !== null && snapshot.ratio >= quotaPressureRatio;
}

export function cacheBudgetPressureLimit(
  snapshot: StorageQuotaSnapshot | null,
  maxBytes = defaultCacheMaxBytes,
): number | null {
  if (!snapshot) return null;
  const quotaLimit = snapshot.quota * quotaPressureRatio;
  return Math.min(quotaLimit, maxBytes);
}

export function isCacheBudgetPressure(
  snapshot: StorageQuotaSnapshot | null,
  maxBytes = defaultCacheMaxBytes,
): boolean {
  const limit = cacheBudgetPressureLimit(snapshot, maxBytes);
  return limit !== null && snapshot !== null && snapshot.usage >= limit;
}
