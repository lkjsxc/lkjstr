import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import { deletePrunedEvents } from './compaction-delete';
import { protectedEventIds } from './compaction-protection';
import { lowestScorePruneRows } from './compaction-select';
import { estimatedEventCacheBytes } from './event-cache-bytes';
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
import type { CacheMetadata } from './cache-status';

export type CacheBudgetReason =
  | 'startup'
  | 'write'
  | 'settings-change'
  | 'manual'
  | 'quota-pressure';

export type CacheBudgetResult = {
  readonly prunedEvents: number;
  readonly prunedBytes: number;
  readonly skippedDrafts: true;
  readonly skipped: boolean;
  readonly reason?: string;
  readonly budgetBytes: number;
  readonly eventCacheTargetBytes: number;
  readonly eventCacheBytes: number;
  readonly browserUsageBytes: number | null;
  readonly protectedOnly: boolean;
};

export type CacheBudgetOptions = {
  readonly maxBytes?: number;
};

export async function enforceCacheBudget(
  reason: CacheBudgetReason,
  options: CacheBudgetOptions = {},
): Promise<CacheBudgetResult> {
  const budgetBytes = options.maxBytes ?? defaultCacheMaxBytes;
  if (!indexedDbAvailable())
    return result(reason, budgetBytes, budgetBytes, 0, null, 0, 0, true, true);
  const quota = await readStorageQuota();
  let eventCacheBytes = await estimatedEventCacheBytes();
  const budget = deriveSiteStorageBudget(eventCacheBytes, budgetBytes, quota);
  if (!shouldCompactForSiteBudget(eventCacheBytes, budget)) {
    const done = result(
      'below-budget-threshold',
      budget.siteBudgetBytes,
      budget.eventCacheTargetBytes,
      eventCacheBytes,
      budget.browserUsageBytes,
      0,
      0,
      false,
      false,
    );
    await writeCacheBudgetResult(done);
    return done;
  }
  let prunedEvents = 0;
  let prunedBytes = 0;
  let protectedOnly = false;
  while (eventCacheBytes > budget.eventCacheTargetBytes) {
    const protectedIds = await protectedEventIds();
    const rows = await lowestScorePruneRows(quotaPruneBatchSize, protectedIds);
    if (rows.length === 0) {
      protectedOnly = true;
      break;
    }
    const deleted = await deletePrunedEvents(rows);
    prunedEvents += deleted.prunedEvents;
    prunedBytes += deleted.prunedBytes;
    eventCacheBytes = await estimatedEventCacheBytes();
  }
  const finalBudget = deriveSiteStorageBudget(
    eventCacheBytes,
    budgetBytes,
    adjustedQuota(quota, prunedBytes),
  );
  const protectedUsageOverBudget =
    finalBudget.protectedOrNonEventBytes >= finalBudget.siteBudgetBytes &&
    finalBudget.browserUsageBytes !== null;
  const done = result(
    protectedUsageOverBudget
      ? 'protected-or-non-cache-usage'
      : protectedOnly
        ? 'protected-only'
        : reason,
    finalBudget.siteBudgetBytes,
    finalBudget.eventCacheTargetBytes,
    eventCacheBytes,
    finalBudget.browserUsageBytes,
    prunedEvents,
    prunedBytes,
    false,
    protectedOnly || protectedUsageOverBudget,
  );
  await writeCacheBudgetResult(done);
  return done;
}

export function shouldCompact(
  eventCacheBytes: number,
  maxBytes: number,
  quota: StorageQuotaSnapshot | null,
): boolean {
  return shouldCompactForSiteBudget(
    eventCacheBytes,
    deriveSiteStorageBudget(eventCacheBytes, maxBytes, quota),
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
    eventCacheTargetBytes: result.eventCacheTargetBytes,
    eventCacheBytes: result.eventCacheBytes,
    browserUsageBytes: result.browserUsageBytes,
    lastCompactionReason: result.reason,
    prunedEventCount: result.prunedEvents,
    prunedByteEstimate: result.prunedBytes,
    protectedOnly: result.protectedOnly,
    updatedAt: Date.now(),
  };
  await browserDb().cacheMeta.put(meta);
}

function result(
  reason: string,
  budgetBytes: number,
  eventCacheTargetBytes: number,
  eventCacheBytes: number,
  browserUsageBytes: number | null,
  prunedEvents: number,
  prunedBytes: number,
  skipped: boolean,
  protectedOnly: boolean,
): CacheBudgetResult {
  return {
    prunedEvents,
    prunedBytes,
    skippedDrafts: true,
    skipped,
    reason,
    budgetBytes,
    eventCacheTargetBytes,
    eventCacheBytes,
    browserUsageBytes,
    protectedOnly,
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
