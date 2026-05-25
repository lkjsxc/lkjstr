import Dexie from 'dexie';
import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import { loadSettings } from '../settings/settings-store';
import { eventRetention } from './retention';
import { pinnedEventIds } from './pins';
import {
  compactFeedCoverage,
  deleteFeedCoverageForFeeds,
} from '../events/feed-coverage-store';
export type CacheCompactionOptions = {
  readonly enabled: boolean;
  readonly maxAgeSeconds: number;
  readonly maxEvents: number;
};

export type CompactionResult = {
  readonly prunedEvents: number;
  readonly skippedDrafts: boolean;
  readonly skipped: boolean;
  readonly reason?: string;
};

export async function compactOldEvents(
  options?: Partial<CacheCompactionOptions>,
): Promise<CompactionResult> {
  const resolved = options
    ? { ...(await cacheCompactionOptions()), ...options }
    : await cacheCompactionOptions();
  if (!resolved.enabled)
    return {
      prunedEvents: 0,
      skippedDrafts: true,
      skipped: true,
      reason: 'compaction disabled',
    };
  if (!indexedDbAvailable())
    return { prunedEvents: 0, skippedDrafts: true, skipped: true };
  const now = Math.floor(Date.now() / 1000);
  const recentIds = await recentEventIds(resolved.maxEvents);
  const priorityIds = await priorityEventIds();
  const pruneIds = await collectPruneIds(
    recentIds,
    priorityIds,
    now,
    resolved.maxAgeSeconds,
  );
  const retainedIds = new Set(recentIds);
  for (const id of priorityIds) retainedIds.add(id);
  await browserDb().transaction(
    'rw',
    browserDb().events,
    browserDb().eventRelays,
    browserDb().eventTags,
    browserDb().feedCursors,
    async () => {
      await browserDb().events.bulkDelete(pruneIds);
      await Promise.all(
        pruneIds.flatMap((id) => [
          browserDb().eventRelays.where('eventId').equals(id).delete(),
          browserDb().eventTags.where('eventId').equals(id).delete(),
        ]),
      );
    },
  );
  await deleteStaleFeedCursors(retainedIds);
  await compactFeedCoverage(resolved.maxAgeSeconds);
  return { prunedEvents: pruneIds.length, skippedDrafts: true, skipped: false };
}

async function recentEventIds(maxEvents: number): Promise<Set<string>> {
  const ids = new Set<string>();
  await browserDb()
    .events.orderBy('created_at')
    .reverse()
    .limit(maxEvents)
    .each((event) => ids.add(event.id));
  return ids;
}

async function priorityEventIds(): Promise<Set<string>> {
  const ids = pinnedEventIds();
  await collectLatestByKindPubkey(0, ids);
  const accountPubkeys = await loadAccountPubkeys();
  if (accountPubkeys.size > 0) {
    await collectLatestByKindPubkeyForSet(3, accountPubkeys, ids);
  }
  return ids;
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
  const latestByPubkey = new Map<string, { id: string; created_at: number }>();
  await browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between(
      [Dexie.minKey, kind, Dexie.minKey],
      [Dexie.maxKey, kind, Dexie.maxKey],
    )
    .each((event) => {
      const current = latestByPubkey.get(event.pubkey);
      if (!current || event.created_at > current.created_at) {
        latestByPubkey.set(event.pubkey, {
          id: event.id,
          created_at: event.created_at,
        });
      }
    });
  for (const item of latestByPubkey.values()) target.add(item.id);
}

async function collectLatestByKindPubkeyForSet(
  kind: number,
  wantedPubkeys: Set<string>,
  target: Set<string>,
): Promise<void> {
  const latestByPubkey = new Map<string, { id: string; created_at: number }>();
  await browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between(
      [Dexie.minKey, kind, Dexie.minKey],
      [Dexie.maxKey, kind, Dexie.maxKey],
    )
    .each((event) => {
      if (!wantedPubkeys.has(event.pubkey)) return;
      const current = latestByPubkey.get(event.pubkey);
      if (!current || event.created_at > current.created_at) {
        latestByPubkey.set(event.pubkey, {
          id: event.id,
          created_at: event.created_at,
        });
      }
    });
  for (const item of latestByPubkey.values()) target.add(item.id);
}

async function collectPruneIds(
  recentIds: Set<string>,
  priorityIds: Set<string>,
  nowSeconds: number,
  maxAgeSeconds: number,
): Promise<string[]> {
  const pruneIds: string[] = [];
  await browserDb()
    .events.orderBy('created_at')
    .reverse()
    .each((event) => {
      if (priorityIds.has(event.id)) return;
      const isRecent = recentIds.has(event.id);
      const shouldPrune =
        !isRecent ||
        eventRetention(event, nowSeconds, maxAgeSeconds) === 'prune';
      if (shouldPrune) pruneIds.push(event.id);
    });
  return pruneIds;
}

export async function cacheCompactionOptions(): Promise<CacheCompactionOptions> {
  const settings = await loadSettings();
  const value = (key: string) =>
    settings.find((item) => item.key === key)?.value;
  const maxAgeDays = Number(value('cache.maxAgeDays') ?? 30);
  const maxEvents = Number(value('cache.maxEvents') ?? 5000);
  return {
    enabled: Boolean(value('cache.compactionEnabled') ?? true),
    maxAgeSeconds: maxAgeDays * 24 * 60 * 60,
    maxEvents,
  };
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
