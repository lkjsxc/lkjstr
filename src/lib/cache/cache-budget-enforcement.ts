import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import { deletePrunedEvents } from './compaction-delete';
import { protectedEventIds } from './compaction-protection';
import { lowestScorePruneRows } from './compaction-select';
import { estimatedEventCacheBytes } from './event-cache-bytes';
import {
  defaultCacheMaxBytes,
  isQuotaPressure,
  quotaPruneBatchSize,
  readStorageQuota,
  type StorageQuotaSnapshot,
} from './storage-quota';
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
    return result(reason, budgetBytes, 0, null, 0, 0, true, true);
  const quota = await readStorageQuota();
  let eventCacheBytes = await estimatedEventCacheBytes();
  if (!shouldCompact(eventCacheBytes, budgetBytes, quota)) {
    const done = result(
      'below-budget-threshold',
      budgetBytes,
      eventCacheBytes,
      quota?.usage ?? null,
      0,
      0,
      false,
      false,
    );
    await writeCacheBudgetResult(done);
    return done;
  }
  if (eventCacheBytes <= budgetBytes && quota && quota.usage > budgetBytes) {
    const done = result(
      'protected-or-non-cache-usage',
      budgetBytes,
      eventCacheBytes,
      quota.usage,
      0,
      0,
      false,
      true,
    );
    await writeCacheBudgetResult(done);
    return done;
  }
  let prunedEvents = 0;
  let prunedBytes = 0;
  let protectedOnly = false;
  while (eventCacheBytes > budgetBytes) {
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
  const done = result(
    protectedOnly ? 'protected-only' : reason,
    budgetBytes,
    eventCacheBytes,
    quota?.usage ?? null,
    prunedEvents,
    prunedBytes,
    false,
    protectedOnly,
  );
  await writeCacheBudgetResult(done);
  return done;
}

export function shouldCompact(
  eventCacheBytes: number,
  maxBytes: number,
  quota: StorageQuotaSnapshot | null,
): boolean {
  return (
    eventCacheBytes > maxBytes ||
    (quota?.usage ?? 0) > maxBytes ||
    isQuotaPressure(quota)
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
    eventCacheBytes,
    browserUsageBytes,
    protectedOnly,
  };
}
