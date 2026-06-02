import { feedCoverageLedgerRecord } from '../../events/feed-cache-ledger';
import type { FeedCoverage } from '../../events/types';
import {
  sqliteDeleteAllFeedCoverage,
  sqliteDeleteExpiredFeedCoverage,
  sqliteDeleteFeedCoverageByFeedKeys,
  sqlitePutFeedCoverageRows,
  sqliteReadFeedCoverageRows,
} from '../sqlite-opfs/feed-cache-sqlite';

export async function putFeedCoverageRowsWithLedger(
  rows: readonly FeedCoverage[],
): Promise<void> {
  await sqlitePutFeedCoverageRows(
    rows,
    rows.map(feedCoverageLedgerRecord),
  ).catch(() => false);
}

export async function readFeedCoverageRowsForFeed(
  feedKey: string,
  fallback: readonly FeedCoverage[],
): Promise<FeedCoverage[]> {
  return (
    (await sqliteReadFeedCoverageRows(feedKey).catch(() => undefined)) ?? [
      ...fallback,
    ]
  );
}

export async function deleteFeedCoverageRowsForFeeds(
  feedKeys: readonly string[],
): Promise<void> {
  await sqliteDeleteFeedCoverageByFeedKeys(feedKeys).catch(() => false);
}

export async function deleteAllFeedCoverageRowsWithLedger(): Promise<void> {
  await sqliteDeleteAllFeedCoverage().catch(() => false);
}

export async function deleteExpiredFeedCoverageRowsWithLedger(
  expired: (coverage: FeedCoverage) => boolean,
): Promise<void> {
  await sqliteDeleteExpiredFeedCoverage(expired).catch(() => false);
}
