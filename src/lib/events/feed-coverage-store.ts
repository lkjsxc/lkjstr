import { browserDb } from '../storage/browser-db';
import { createBoundedMap } from '../fp/bounded-map';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import { cacheLedgerId } from '../cache/cache-ledger-id';
import { feedCoverageLedgerRecord } from './feed-cache-ledger';
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
  await bestEffortStorageWrite(() =>
    browserDb().transaction(
      'rw',
      browserDb().feedCoverage,
      browserDb().cacheLedger,
      async () => {
        await browserDb().feedCoverage.bulkPut([...rows]);
        await browserDb().cacheLedger.bulkPut(
          rows.map(feedCoverageLedgerRecord),
        );
      },
    ),
  );
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
  return boundedStorageRead(
    () => browserDb().feedCoverage.where('feedKey').equals(feedKey).toArray(),
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
  await bestEffortStorageWrite(async () => {
    const rows = await browserDb()
      .feedCoverage.where('feedKey')
      .anyOf([...keys])
      .toArray();
    await browserDb().feedCoverage.bulkDelete(rows.map((row) => row.id));
    await browserDb().cacheLedger.bulkDelete(
      rows.map((row) => cacheLedgerId('feed-coverage', row.id)),
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
  for (const [id, value] of memoryCoverage.entries())
    if (expired(value)) memoryCoverage.delete(id);
  await bestEffortStorageWrite(async () => {
    const ids: string[] = [];
    await browserDb().feedCoverage.each((row) => {
      if (expired(row)) ids.push(row.id);
    });
    if (ids.length > 0) {
      await browserDb().feedCoverage.bulkDelete(ids);
      await browserDb().cacheLedger.bulkDelete(
        ids.map((id) => cacheLedgerId('feed-coverage', id)),
      );
    }
  });
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
