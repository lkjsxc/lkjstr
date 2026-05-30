import { browserDb } from '../storage/browser-db';
import {
  compactFeedCoverage,
  deleteFeedCoverageForFeeds,
} from '../events/feed-coverage-store';
import type { CacheLedgerRecord } from './cache-ledger-record';

export type PruneDeleteResult = {
  readonly prunedEvents: number;
  readonly prunedBytes: number;
};

export async function deletePrunedEvents(
  rows: readonly CacheLedgerRecord[],
): Promise<PruneDeleteResult> {
  const ids = rows.map((row) => row.resourceId);
  if (ids.length === 0) return { prunedEvents: 0, prunedBytes: 0 };
  await browserDb().transaction(
    'rw',
    [
      browserDb().events,
      browserDb().eventRelays,
      browserDb().eventTags,
      browserDb().cacheLedger,
      browserDb().feedCursors,
    ],
    async () => {
      await browserDb().events.bulkDelete(ids);
      await browserDb().cacheLedger.bulkDelete(rows.map((row) => row.id));
      await Promise.all(
        ids.flatMap((id) => [
          browserDb().eventRelays.where('eventId').equals(id).delete(),
          browserDb().eventTags.where('eventId').equals(id).delete(),
        ]),
      );
    },
  );
  await deleteStaleFeedCursors(new Set(ids));
  await compactFeedCoverage(30 * 24 * 60 * 60);
  return {
    prunedEvents: ids.length,
    prunedBytes: rows.reduce((sum, row) => sum + (row.cacheBytes ?? 0), 0),
  };
}

async function deleteStaleFeedCursors(prunedIds: Set<string>): Promise<void> {
  const stale: { id: string; feedKey: string }[] = [];
  await browserDb().feedCursors.each((cursor) => {
    const ids = [cursor.oldest?.id, cursor.newest?.id].filter(
      (id): id is string => Boolean(id),
    );
    if (ids.some((id) => prunedIds.has(id))) {
      stale.push({ id: cursor.id, feedKey: cursor.feedKey });
    }
  });
  if (stale.length === 0) return;
  await browserDb().feedCursors.bulkDelete(stale.map((cursor) => cursor.id));
  await deleteFeedCoverageForFeeds(stale.map((cursor) => cursor.feedKey));
}
