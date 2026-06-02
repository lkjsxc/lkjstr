import { feedCoverageLedgerRecord } from '../../events/feed-cache-ledger';
import type { FeedCoverage } from '../../events/types';
import {
  sqliteDeleteAllFeedCoverage,
  sqliteDeleteExpiredFeedCoverage,
  sqliteDeleteFeedCoverageByFeedKeys,
  sqlitePutFeedCoverageRows,
  sqliteReadFeedCoverageRows,
  sqliteReadFeedCoverageRowsForRequirements,
  type CoverageRequirementRow,
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

export async function readFeedCoverageRowsForRequirements(
  feedKey: string,
  requirements: readonly CoverageRequirementRow[],
  fallback: readonly FeedCoverage[],
): Promise<FeedCoverage[]> {
  return (
    (await sqliteReadFeedCoverageRowsForRequirements(
      feedKey,
      requirements,
    ).catch(() => undefined)) ?? exactFallback(feedKey, requirements, fallback)
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

function exactFallback(
  feedKey: string,
  requirements: readonly CoverageRequirementRow[],
  rows: readonly FeedCoverage[],
): FeedCoverage[] {
  return rows.filter(
    (row) =>
      row.feedKey === feedKey &&
      requirements.some((requirement) => overlaps(row, requirement)),
  );
}

function overlaps(
  row: FeedCoverage,
  requirement: CoverageRequirementRow,
): boolean {
  return (
    row.groupKey === requirement.groupKey &&
    row.relayUrl === requirement.relayUrl &&
    row.filterKey === requirement.filterKey &&
    row.status === 'complete' &&
    row.since !== undefined &&
    row.until !== undefined &&
    requirement.since !== undefined &&
    requirement.until !== undefined &&
    row.since < requirement.until &&
    row.until > requirement.since
  );
}
