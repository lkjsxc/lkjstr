import {
  cacheBudgetPressureLimit,
  isQuotaPressure,
  type StorageQuotaSnapshot,
} from './storage-quota';

export type SiteStorageBudget = {
  readonly siteBudgetBytes: number;
  readonly browserUsageBytes: number | null;
  readonly overSiteBudget: boolean;
  readonly quotaPressure: boolean;
};

export function deriveSiteStorageBudget(
  maxBytes: number,
  quota: StorageQuotaSnapshot | null,
): SiteStorageBudget {
  const siteBudgetBytes = Math.floor(
    cacheBudgetPressureLimit(quota, maxBytes) ?? maxBytes,
  );
  const browserUsageBytes = quota?.usage ?? null;
  return {
    siteBudgetBytes,
    browserUsageBytes,
    overSiteBudget:
      browserUsageBytes !== null && browserUsageBytes > siteBudgetBytes,
    quotaPressure: isQuotaPressure(quota),
  };
}

export function shouldCompactForSiteBudget(
  prunableCacheBytes: number,
  budget: SiteStorageBudget,
): boolean {
  if (prunableCacheBytes <= 0) return false;
  return (
    prunableCacheBytes > budget.siteBudgetBytes ||
    budget.overSiteBudget ||
    budget.quotaPressure
  );
}
