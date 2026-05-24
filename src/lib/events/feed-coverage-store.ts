import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import type { FeedCoverage } from './types';

const memoryCoverage = new Map<string, FeedCoverage>();

export async function saveFeedCoverage(
  input: Omit<FeedCoverage, 'id' | 'updatedAt'>,
): Promise<FeedCoverage> {
  const coverage = {
    ...input,
    id: coverageId(input),
    updatedAt: Date.now(),
  };
  memoryCoverage.set(coverage.id, coverage);
  await bestEffortStorageWrite(() => browserDb().feedCoverage.put(coverage));
  return coverage;
}

export async function coverageForFeed(
  feedKey: string,
): Promise<FeedCoverage[]> {
  return boundedStorageRead(
    () => browserDb().feedCoverage.where('feedKey').equals(feedKey).toArray(),
    [...memoryCoverage.values()].filter((item) => item.feedKey === feedKey),
  );
}

export async function deleteFeedCoverageForFeeds(
  feedKeys: readonly string[],
): Promise<void> {
  const keys = new Set(feedKeys);
  for (const [id, value] of memoryCoverage)
    if (keys.has(value.feedKey)) memoryCoverage.delete(id);
  await bestEffortStorageWrite(async () => {
    await Promise.all(
      [...keys].map((key) =>
        browserDb().feedCoverage.where('feedKey').equals(key).delete(),
      ),
    );
  });
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
  for (const [id, value] of memoryCoverage)
    if (expired(value)) memoryCoverage.delete(id);
  await bestEffortStorageWrite(async () => {
    const rows = await browserDb().feedCoverage.toArray();
    const ids = rows.filter(expired).map((row) => row.id);
    if (ids.length > 0) await browserDb().feedCoverage.bulkDelete(ids);
  });
}

export function clearFeedCoverageForTests(): void {
  memoryCoverage.clear();
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
