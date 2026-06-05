import { compactFeedCoverage } from '../events/feed-coverage-store';
import {
  sqliteDeleteDirectCacheRows,
  sqliteDeleteEventCacheRows,
} from '../storage/sqlite-opfs/cache-compaction-sqlite';
import type { CacheLedgerRecord } from './cache-ledger-record';

export type PruneDeleteResult = {
  readonly prunedEvents: number;
  readonly prunedResources: number;
  readonly prunedBytes: number;
};

export async function deleteCacheLedgerResources(
  rows: readonly CacheLedgerRecord[],
): Promise<PruneDeleteResult> {
  const events = rows.filter((row) => row.resourceKind === 'nostr-event');
  const direct = rows.filter((row) => row.resourceKind !== 'nostr-event');
  const eventResult = await deletePrunedEvents(events);
  await deleteDirectCacheRows(direct);
  return {
    prunedEvents: eventResult.prunedEvents,
    prunedResources: eventResult.prunedResources + direct.length,
    prunedBytes:
      eventResult.prunedBytes +
      direct.reduce((sum, row) => sum + (row.cacheBytes ?? 0), 0),
  };
}

export async function deletePrunedEvents(
  rows: readonly CacheLedgerRecord[],
): Promise<PruneDeleteResult> {
  const ids = rows.map((row) => row.resourceId);
  if (ids.length === 0)
    return { prunedEvents: 0, prunedResources: 0, prunedBytes: 0 };
  await sqliteDeleteEventCacheRows(rows);
  await compactFeedCoverage(30 * 24 * 60 * 60);
  return {
    prunedEvents: ids.length,
    prunedResources: ids.length,
    prunedBytes: rows.reduce((sum, row) => sum + (row.cacheBytes ?? 0), 0),
  };
}

async function deleteDirectCacheRows(
  rows: readonly CacheLedgerRecord[],
): Promise<void> {
  if (rows.length === 0) return;
  await sqliteDeleteDirectCacheRows(rows);
}
