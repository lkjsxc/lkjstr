import { browserDb } from '../storage/browser-db';
import {
  compactFeedCoverage,
  deleteAllFeedCoverageAfterEventCompaction,
  deleteFeedCoverageForFeeds,
} from '../events/feed-coverage-store';
import { directLedgerResourceSpecs } from '../storage/ledger/ledger-manifest';
import { cacheLedgerId } from './cache-ledger-id';
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
  await deleteAllFeedCoverageAfterEventCompaction();
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
  await browserDb().transaction(
    'rw',
    [
      browserDb().notifications,
      browserDb().feedCursors,
      browserDb().feedCoverage,
      browserDb().feedScanHints,
      browserDb().relayDiagnosticSummaries,
      browserDb().relayInformation,
      browserDb().relayListSuggestions,
      browserDb().authorRelayRoutes,
      browserDb().jobs,
      browserDb().tabStates,
      browserDb().cacheLedger,
    ],
    async () => {
      for (const spec of directLedgerResourceSpecs()) {
        await deleteByKind(
          rows,
          spec.resourceKind,
          browserDb()[spec.owningTable],
        );
      }
      await browserDb().cacheLedger.bulkDelete(rows.map((row) => row.id));
    },
  );
}

async function deleteByKind(
  rows: readonly CacheLedgerRecord[],
  kind: CacheLedgerRecord['resourceKind'],
  table: { bulkDelete: (ids: string[]) => Promise<unknown> },
): Promise<void> {
  const ids = rows
    .filter((row) => row.resourceKind === kind)
    .map((row) => row.resourceId);
  if (ids.length > 0) await table.bulkDelete(ids);
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
  await browserDb().cacheLedger.bulkDelete(
    stale.map((cursor) => cacheLedgerId('feed-page', cursor.id)),
  );
  await deleteFeedCoverageForFeeds(stale.map((cursor) => cursor.feedKey));
}
