import Dexie from 'dexie';
import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import type { EventPriorityRecord } from './event-priority';
import { pinnedEventIds } from './pins';
import {
  compactFeedCoverage,
  deleteFeedCoverageForFeeds,
} from '../events/feed-coverage-store';
import {
  isCacheBudgetPressure,
  quotaPruneBatchSize,
  readStorageQuota,
} from './storage-quota';

export type CompactionResult = {
  readonly prunedEvents: number;
  readonly skippedDrafts: boolean;
  readonly skipped: boolean;
  readonly reason?: string;
};

export type CompactionOptions = {
  readonly maxBytes?: number;
};

export type CompactionEventCandidate = {
  readonly id: string;
  readonly pubkey: string;
  readonly kind: number;
  readonly created_at: number;
};

export function latestEventIdsByPubkey(
  events: readonly CompactionEventCandidate[],
  kind: number,
  wantedPubkeys?: ReadonlySet<string>,
): Set<string> {
  const latestByPubkey = new Map<string, CompactionEventCandidate>();
  for (const event of events) {
    if (event.kind !== kind) continue;
    if (wantedPubkeys && !wantedPubkeys.has(event.pubkey)) continue;
    const current = latestByPubkey.get(event.pubkey);
    if (!current || event.created_at > current.created_at)
      latestByPubkey.set(event.pubkey, event);
  }
  return new Set([...latestByPubkey.values()].map((event) => event.id));
}

export function selectPruneIds(
  rows: readonly EventPriorityRecord[],
  protectedIds: ReadonlySet<string>,
  needed: number,
): string[] {
  return rows
    .filter((row) => isPrunablePriorityRow(row, protectedIds))
    .sort((a, b) => a.score - b.score)
    .slice(0, needed)
    .map((row) => row.id);
}

export function isPrunablePriorityRow(
  row: EventPriorityRecord,
  protectedIds: ReadonlySet<string>,
): boolean {
  return !protectedIds.has(row.id) && !row.protected;
}

export async function compactOldEvents(
  options: CompactionOptions = {},
): Promise<CompactionResult> {
  if (!indexedDbAvailable())
    return { prunedEvents: 0, skippedDrafts: true, skipped: true };
  const quota = await readStorageQuota();
  if (!isCacheBudgetPressure(quota, options.maxBytes))
    return {
      prunedEvents: 0,
      skippedDrafts: true,
      skipped: false,
      reason: 'below-budget-threshold',
    };
  const protectedIds = await protectedEventIds();
  const pruneIds = await lowestScorePruneIds(quotaPruneBatchSize, protectedIds);
  if (pruneIds.length === 0)
    return {
      prunedEvents: 0,
      skippedDrafts: true,
      skipped: false,
      reason: 'nothing-to-prune',
    };
  const retainedIds = new Set<string>(protectedIds);
  await browserDb().transaction(
    'rw',
    [
      browserDb().events,
      browserDb().eventRelays,
      browserDb().eventTags,
      browserDb().eventPriority,
      browserDb().feedCursors,
    ],
    async () => {
      await browserDb().events.bulkDelete(pruneIds);
      await browserDb().eventPriority.bulkDelete(pruneIds);
      await Promise.all(
        pruneIds.flatMap((id) => [
          browserDb().eventRelays.where('eventId').equals(id).delete(),
          browserDb().eventTags.where('eventId').equals(id).delete(),
        ]),
      );
    },
  );
  await deleteStaleFeedCursors(retainedIds);
  await compactFeedCoverage(30 * 24 * 60 * 60);
  return { prunedEvents: pruneIds.length, skippedDrafts: true, skipped: false };
}

async function protectedEventIds(): Promise<Set<string>> {
  const ids = pinnedEventIds();
  await collectLatestByKindPubkey(0, ids);
  const accountPubkeys = await loadAccountPubkeys();
  if (accountPubkeys.size > 0)
    await collectLatestByKindPubkeyForSet(3, accountPubkeys, ids);
  await browserDb()
    .eventPriority.filter((row) => row.protected)
    .each((row) => ids.add(row.id));
  return ids;
}

async function lowestScorePruneIds(
  needed: number,
  protectedIds: Set<string>,
): Promise<string[]> {
  const pruneIds: string[] = [];
  await browserDb()
    .eventPriority.orderBy('score')
    .each((row: EventPriorityRecord) => {
      if (pruneIds.length >= needed) return false;
      if (isPrunablePriorityRow(row, protectedIds)) pruneIds.push(row.id);
    });
  return pruneIds;
}

async function loadAccountPubkeys(): Promise<Set<string>> {
  const pubkeys = new Set<string>();
  await browserDb().accounts.each((account) => pubkeys.add(account.pubkey));
  return pubkeys;
}

async function collectLatestByKindPubkey(
  kind: number,
  target: Set<string>,
): Promise<void> {
  const events: CompactionEventCandidate[] = [];
  await browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between(
      [Dexie.minKey, kind, Dexie.minKey],
      [Dexie.maxKey, kind, Dexie.maxKey],
    )
    .each((event) => {
      events.push(event);
    });
  for (const id of latestEventIdsByPubkey(events, kind)) target.add(id);
}

async function collectLatestByKindPubkeyForSet(
  kind: number,
  wantedPubkeys: Set<string>,
  target: Set<string>,
): Promise<void> {
  const events: CompactionEventCandidate[] = [];
  await browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between(
      [Dexie.minKey, kind, Dexie.minKey],
      [Dexie.maxKey, kind, Dexie.maxKey],
    )
    .each((event) => {
      events.push(event);
    });
  for (const id of latestEventIdsByPubkey(events, kind, wantedPubkeys))
    target.add(id);
}

async function deleteStaleFeedCursors(retainedIds: Set<string>): Promise<void> {
  const stale: { id: string; feedKey: string }[] = [];
  await browserDb().feedCursors.each((cursor) => {
    const ids = [cursor.oldest?.id, cursor.newest?.id].filter(
      (id): id is string => Boolean(id),
    );
    if (ids.some((id) => !retainedIds.has(id))) {
      stale.push({ id: cursor.id, feedKey: cursor.feedKey });
    }
  });
  if (stale.length === 0) return;
  await browserDb().feedCursors.bulkDelete(stale.map((cursor) => cursor.id));
  await deleteFeedCoverageForFeeds(stale.map((cursor) => cursor.feedKey));
}
