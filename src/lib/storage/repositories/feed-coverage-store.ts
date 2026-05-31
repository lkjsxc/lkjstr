import { cacheLedgerId } from '../../cache/cache-ledger-id';
import { feedCoverageLedgerRecord } from '../../events/feed-cache-ledger';
import type { FeedCoverage } from '../../events/types';
import { browserDb, type LkjstrDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';
import { boundedStorageRead } from '../safe-storage';

export async function putFeedCoverageRowsWithLedger(
  rows: readonly FeedCoverage[],
): Promise<void> {
  if (rows.length === 0) return;
  await withStorageTransaction({
    mode: 'rw',
    tables: ['feedCoverage', 'cacheLedger'],
    purpose: 'feed-coverage-write',
    run: async (db) => {
      await db.feedCoverage.bulkPut([...rows]);
      await db.cacheLedger.bulkPut(rows.map(feedCoverageLedgerRecord));
    },
  });
}

export async function readFeedCoverageRowsForFeed(
  feedKey: string,
  fallback: readonly FeedCoverage[],
): Promise<FeedCoverage[]> {
  return boundedStorageRead(
    () => browserDb().feedCoverage.where('feedKey').equals(feedKey).toArray(),
    [...fallback],
  );
}

export async function deleteFeedCoverageRowsForFeeds(
  feedKeys: readonly string[],
): Promise<void> {
  const uniqueFeedKeys = [...new Set(feedKeys)];
  if (uniqueFeedKeys.length === 0) return;
  await withStorageTransaction({
    mode: 'rw',
    tables: ['feedCoverage', 'cacheLedger'],
    purpose: 'feed-coverage-write',
    run: async (db) => {
      const rows = await db.feedCoverage
        .where('feedKey')
        .anyOf(uniqueFeedKeys)
        .toArray();
      await deleteFeedCoverageRowsById(
        db,
        rows.map((row) => row.id),
      );
    },
  });
}

export async function deleteAllFeedCoverageRowsWithLedger(): Promise<void> {
  await deleteFeedCoverageRowsWhere(() => true);
}

export async function deleteExpiredFeedCoverageRowsWithLedger(
  expired: (coverage: FeedCoverage) => boolean,
): Promise<void> {
  await deleteFeedCoverageRowsWhere(expired);
}

async function deleteFeedCoverageRowsWhere(
  shouldDelete: (coverage: FeedCoverage) => boolean,
): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['feedCoverage', 'cacheLedger'],
    purpose: 'feed-coverage-write',
    run: async (db) => {
      const ids: string[] = [];
      await db.feedCoverage.each((row) => {
        if (shouldDelete(row)) ids.push(row.id);
      });
      await deleteFeedCoverageRowsById(db, ids);
    },
  });
}

async function deleteFeedCoverageRowsById(
  db: LkjstrDb,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  await db.feedCoverage.bulkDelete([...ids]);
  await db.cacheLedger.bulkDelete(
    ids.map((id) => cacheLedgerId('feed-coverage', id)),
  );
}
