import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import type { CacheMetadata } from './cache-status';
import {
  cacheBudgetResult,
  type CacheBudgetResult,
} from './cache-budget-result';
import { deleteCacheLedgerResources } from './compaction-delete';
import { protectedEventIds } from './compaction-protection';
import { lowestScorePruneRows } from './compaction-select';
import {
  estimatedEventCacheBytes,
  estimatedLedgerBytes,
  estimatedPrunableCacheBytes,
} from './cache-ledger-stats';
import {
  defaultCacheMaxBytes,
  quotaPruneBatchSize,
  readStorageQuota,
  type StorageQuotaSnapshot,
} from './storage-quota';
import {
  deriveSiteStorageBudget,
  shouldCompactForSiteBudget,
} from './site-storage-budget';

export type { CacheBudgetResult } from './cache-budget-result';

export type CacheBudgetReason =
  | 'startup'
  | 'write'
  | 'settings-change'
  | 'manual'
  | 'quota-pressure';

export type CacheBudgetOptions = {
  readonly maxBytes?: number;
};

export async function enforceCacheBudget(
  reason: CacheBudgetReason,
  options: CacheBudgetOptions = {},
): Promise<CacheBudgetResult> {
  const budgetBytes = options.maxBytes ?? defaultCacheMaxBytes;
  if (!indexedDbAvailable())
    return cacheBudgetResult({
      reason,
      budgetBytes,
      ledgerBytes: 0,
      prunableCacheBytes: 0,
      protectedUserBytes: 0,
      unknownOrOverheadBytes: 0,
      browserUsageBytes: null,
      prunedEvents: 0,
      prunedResources: 0,
      prunedBytes: 0,
      eventCacheBytes: 0,
      skipped: true,
      protectedOnly: true,
    });
  let quota = await readStorageQuota();
  let stats = await ledgerStats(quota);
  const budget = deriveSiteStorageBudget(budgetBytes, quota);
  if (!shouldCompactForSiteBudget(stats.prunableCacheBytes, budget)) {
    const done = cacheBudgetResult({
      reason: 'below-budget-threshold',
      budgetBytes: budget.siteBudgetBytes,
      ledgerBytes: stats.ledgerBytes,
      prunableCacheBytes: stats.prunableCacheBytes,
      protectedUserBytes: 0,
      unknownOrOverheadBytes: stats.unknownOrOverheadBytes,
      browserUsageBytes: budget.browserUsageBytes,
      prunedEvents: 0,
      prunedResources: 0,
      prunedBytes: 0,
      eventCacheBytes: stats.eventCacheBytes,
      skipped: false,
      protectedOnly: false,
    });
    await writeCacheBudgetResult(done);
    return done;
  }
  let prunedEvents = 0;
  let prunedResources = 0;
  let prunedBytes = 0;
  let protectedOnly = false;
  while (
    shouldCompactForSiteBudget(
      stats.prunableCacheBytes,
      deriveSiteStorageBudget(budgetBytes, quota),
    )
  ) {
    const protectedIds = await protectedEventIds();
    const rows = await lowestScorePruneRows(quotaPruneBatchSize, protectedIds);
    if (rows.length === 0) {
      protectedOnly = true;
      break;
    }
    const deleted = await deleteCacheLedgerResources(rows);
    prunedEvents += deleted.prunedEvents;
    prunedResources += deleted.prunedResources;
    prunedBytes += deleted.prunedBytes;
    quota = adjustedQuota(quota, deleted.prunedBytes);
    stats = await ledgerStats(quota);
  }
  const finalBudget = deriveSiteStorageBudget(budgetBytes, quota);
  const protectedPressure =
    finalBudget.overSiteBudget && stats.prunableCacheBytes === 0;
  const done = cacheBudgetResult({
    reason: protectedPressure
      ? 'protected-or-unknown-usage'
      : protectedOnly
        ? 'protected-only'
        : reason,
    budgetBytes: finalBudget.siteBudgetBytes,
    ledgerBytes: stats.ledgerBytes,
    prunableCacheBytes: stats.prunableCacheBytes,
    protectedUserBytes: 0,
    unknownOrOverheadBytes: stats.unknownOrOverheadBytes,
    browserUsageBytes: finalBudget.browserUsageBytes,
    prunedEvents,
    prunedResources,
    prunedBytes,
    eventCacheBytes: stats.eventCacheBytes,
    skipped: false,
    protectedOnly: protectedOnly || protectedPressure,
  });
  await writeCacheBudgetResult(done);
  return done;
}

export function shouldCompact(
  prunableCacheBytes: number,
  maxBytes: number,
  quota: StorageQuotaSnapshot | null,
): boolean {
  return shouldCompactForSiteBudget(
    prunableCacheBytes,
    deriveSiteStorageBudget(maxBytes, quota),
  );
}

async function writeCacheBudgetResult(
  result: CacheBudgetResult,
): Promise<void> {
  const meta: CacheMetadata = {
    id: 'main',
    rawEventCount: await browserDb().events.count(),
    profileCount: 0,
    notificationCount: await browserDb().notifications.count(),
    storageEstimateBytes: result.browserUsageBytes,
    budgetBytes: result.budgetBytes,
    ledgerBytes: result.ledgerBytes,
    prunableCacheBytes: result.prunableCacheBytes,
    protectedUserBytes: result.protectedUserBytes,
    unknownOrOverheadBytes: result.unknownOrOverheadBytes,
    eventCacheBytes: result.eventCacheBytes,
    browserUsageBytes: result.browserUsageBytes,
    lastCompactionReason: result.reason,
    prunedEventCount: result.prunedEvents,
    prunedResourceCount: result.prunedResources,
    prunedByteEstimate: result.prunedBytes,
    protectedOnly: result.protectedOnly,
    protectedOrUnknownOnly: result.protectedOnly,
    ledgerInventory: [],
    storageInventory: [],
    updatedAt: Date.now(),
  };
  await browserDb().cacheMeta.put(meta);
}

async function ledgerStats(quota: StorageQuotaSnapshot | null) {
  const ledgerBytes = await estimatedLedgerBytes();
  return {
    ledgerBytes,
    prunableCacheBytes: await estimatedPrunableCacheBytes(),
    eventCacheBytes: await estimatedEventCacheBytes(),
    unknownOrOverheadBytes:
      quota === null ? 0 : Math.max(0, quota.usage - ledgerBytes),
  };
}

function adjustedQuota(
  quota: StorageQuotaSnapshot | null,
  prunedBytes: number,
): StorageQuotaSnapshot | null {
  if (!quota || prunedBytes <= 0) return quota;
  const usage = Math.max(0, quota.usage - prunedBytes);
  return { ...quota, usage, ratio: usage / quota.quota };
}
