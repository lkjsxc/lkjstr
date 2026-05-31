import { createBoundedMap } from '../fp/bounded-map';
import {
  deleteAllFeedCoverageRowsWithLedger,
  deleteExpiredFeedCoverageRowsWithLedger,
  deleteFeedCoverageRowsForFeeds,
  putFeedCoverageRowsWithLedger,
  readFeedCoverageRowsForFeed,
} from '../storage/repositories/feed-coverage-store';
import type { FeedCoverage } from './types';

const memoryCoverage = createBoundedMap<string, FeedCoverage>({
  maxSize: 500,
});

export async function saveFeedCoverage(
  input: Omit<FeedCoverage, 'id' | 'updatedAt'>,
): Promise<FeedCoverage> {
  const [coverage] = await saveFeedCoverageRows([input]);
  return coverage!;
}

export async function saveFeedCoverageRows(
  inputs: readonly Omit<FeedCoverage, 'id' | 'updatedAt'>[],
): Promise<FeedCoverage[]> {
  const updatedAt = Date.now();
  const rows = inputs.map((input) => feedCoverageRow(input, updatedAt));
  for (const row of rows) memoryCoverage.set(row.id, row);
  if (rows.length === 0) return [];
  await putFeedCoverageRowsWithLedger(rows);
  return rows;
}

function feedCoverageRow(
  input: Omit<FeedCoverage, 'id' | 'updatedAt'>,
  updatedAt: number,
): FeedCoverage {
  const coverage = {
    ...input,
    id: coverageId(input),
    updatedAt,
  };
  return coverage;
}

export async function coverageForFeed(
  feedKey: string,
): Promise<FeedCoverage[]> {
  return readFeedCoverageRowsForFeed(
    feedKey,
    [...memoryCoverage.values()].filter((item) => item.feedKey === feedKey),
  );
}

export async function deleteFeedCoverageForFeeds(
  feedKeys: readonly string[],
): Promise<void> {
  const keys = new Set(feedKeys);
  if (keys.size === 0) return;
  for (const [id, value] of memoryCoverage.entries())
    if (keys.has(value.feedKey)) memoryCoverage.delete(id);
  await deleteFeedCoverageRowsForFeeds([...keys]);
}

export async function deleteAllFeedCoverageAfterEventCompaction(): Promise<void> {
  memoryCoverage.clear();
  await deleteAllFeedCoverageRowsWithLedger();
}

export async function compactFeedCoverage(
  maxAgeSeconds: number,
): Promise<void> {
  const now = Date.now();
  const completeCutoff = now - maxAgeSeconds * 1000;
  const diagnosticCutoff = now - maxAgeSeconds * 3 * 1000;
  const expired = (coverage: FeedCoverage) =>
    coverage.updatedAt <
    (coverage.status === 'complete' ? completeCutoff : diagnosticCutoff);
  for (const [id, value] of memoryCoverage.entries())
    if (expired(value)) memoryCoverage.delete(id);
  await deleteExpiredFeedCoverageRowsWithLedger(expired);
}

export function clearFeedCoverageForTests(): void {
  memoryCoverage.clear();
}

export function feedCoverageMemorySizeForTests(): number {
  return memoryCoverage.size();
}

function coverageId(input: Omit<FeedCoverage, 'id' | 'updatedAt'>): string {
  return [
    input.feedKey,
    input.groupKey,
    input.relayUrl,
    input.filterKey,
    input.since ?? '',
    input.until ?? '',
  ].join('|');
}
