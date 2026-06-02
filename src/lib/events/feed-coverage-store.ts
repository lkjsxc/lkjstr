import { createBoundedMap } from '../fp/bounded-map';
import {
  deleteAllFeedCoverageRowsWithLedger,
  deleteExpiredFeedCoverageRowsWithLedger,
  deleteFeedCoverageRowsForFeeds,
  putFeedCoverageRowsWithLedger,
  readFeedCoverageRowsForFeed,
  readFeedCoverageRowsForRequirements,
} from '../storage/repositories/feed-coverage-store';
import type { FeedCoverage } from './types';

const memoryCoverage = createBoundedMap<string, FeedCoverage>({
  maxSize: 500,
});
const durableCoverageKeys = createBoundedMap<string, number>({
  maxSize: 1000,
});
const durableRefreshMs = 10_000;

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
  const durableRows = rows.filter((row) =>
    shouldPersistCoverage(memoryCoverage.get(row.id), row),
  );
  for (const row of rows) memoryCoverage.set(row.id, row);
  for (const row of durableRows)
    durableCoverageKeys.set(durableCoverageKey(row), row.updatedAt);
  if (rows.length === 0) return [];
  await putFeedCoverageRowsWithLedger(durableRows);
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
  return readFeedCoverageRowsForFeed(feedKey, memoryCoverageForFeed(feedKey));
}

export async function coverageForRequirements(
  feedKey: string,
  requirements: readonly CoverageRequirementIdentity[],
): Promise<FeedCoverage[]> {
  return readFeedCoverageRowsForRequirements(
    feedKey,
    requirements,
    memoryCoverageForFeed(feedKey),
  );
}

export type CoverageRequirementIdentity = {
  readonly groupKey: string;
  readonly relayUrl: string;
  readonly filterKey: string;
  readonly since?: number;
  readonly until?: number;
};

export async function deleteFeedCoverageForFeeds(
  feedKeys: readonly string[],
): Promise<void> {
  const keys = new Set(feedKeys);
  if (keys.size === 0) return;
  for (const [id, value] of memoryCoverage.entries())
    if (keys.has(value.feedKey)) memoryCoverage.delete(id);
  durableCoverageKeys.clear();
  await deleteFeedCoverageRowsForFeeds([...keys]);
}

export async function deleteAllFeedCoverageAfterEventCompaction(): Promise<void> {
  memoryCoverage.clear();
  durableCoverageKeys.clear();
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
  durableCoverageKeys.clear();
}

export function feedCoverageMemorySizeForTests(): number {
  return memoryCoverage.size();
}

function memoryCoverageForFeed(feedKey: string): FeedCoverage[] {
  return [...memoryCoverage.values()].filter(
    (item) => item.feedKey === feedKey,
  );
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

function shouldPersistCoverage(
  existing: FeedCoverage | undefined,
  next: FeedCoverage,
): boolean {
  if (existing && !sameCoverageProof(existing, next)) return true;
  const lastPersistedAt = durableCoverageKeys.get(durableCoverageKey(next));
  if (lastPersistedAt && next.updatedAt - lastPersistedAt < durableRefreshMs)
    return false;
  if (!existing) return true;
  if (next.updatedAt - existing.updatedAt >= durableRefreshMs) return true;
  return false;
}

function durableCoverageKey(row: FeedCoverage): string {
  return [
    row.feedKey,
    row.groupKey,
    row.relayUrl,
    row.filterKey,
    row.status,
    row.direction ?? '',
  ].join('|');
}

function sameCoverageProof(left: FeedCoverage, right: FeedCoverage): boolean {
  return (
    left.status === right.status &&
    left.reason === right.reason &&
    left.limit === right.limit &&
    left.eventCount === right.eventCount &&
    left.uniqueCount === right.uniqueCount &&
    left.attempt === right.attempt &&
    left.spanSeconds === right.spanSeconds &&
    left.nextSpanSeconds === right.nextSpanSeconds &&
    left.feedback === right.feedback &&
    left.direction === right.direction
  );
}
