import {
  cacheBudgetPressureLimit,
  isQuotaPressure,
  type StorageQuotaSnapshot,
} from './storage-quota';

export type SiteStorageBudget = {
  readonly siteBudgetBytes: number;
  readonly eventCacheTargetBytes: number;
  readonly protectedOrNonEventBytes: number;
  readonly browserUsageBytes: number | null;
  readonly overSiteBudget: boolean;
  readonly quotaPressure: boolean;
};

export function deriveSiteStorageBudget(
  eventCacheBytes: number,
  maxBytes: number,
  quota: StorageQuotaSnapshot | null,
): SiteStorageBudget {
  const siteBudgetBytes = Math.floor(
    cacheBudgetPressureLimit(quota, maxBytes) ?? maxBytes,
  );
  const browserUsageBytes = quota?.usage ?? null;
  const protectedOrNonEventBytes =
    browserUsageBytes === null
      ? 0
      : Math.max(0, browserUsageBytes - eventCacheBytes);
  const eventCacheTargetBytes = Math.max(
    0,
    siteBudgetBytes - protectedOrNonEventBytes,
  );
  return {
    siteBudgetBytes,
    eventCacheTargetBytes,
    protectedOrNonEventBytes,
    browserUsageBytes,
    overSiteBudget:
      browserUsageBytes !== null && browserUsageBytes > siteBudgetBytes,
    quotaPressure: isQuotaPressure(quota),
  };
}

export function shouldCompactForSiteBudget(
  eventCacheBytes: number,
  budget: SiteStorageBudget,
): boolean {
  return (
    eventCacheBytes > budget.eventCacheTargetBytes ||
    budget.overSiteBudget ||
    budget.quotaPressure
  );
}
