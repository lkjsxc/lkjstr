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
  const events = (await browserDb().events.toArray()).sort(
    (a, b) => b.created_at - a.created_at,
  );
  const recentIds = new Set(
    events.slice(0, resolved.maxEvents).map((event) => event.id),
  );
  const priorityIds = await priorityEventIds(events);
  const pruneIds = events
    .filter(
      (event) =>
        !priorityIds.has(event.id) &&
        (!recentIds.has(event.id) ||
          eventRetention(event, now, resolved.maxAgeSeconds) === 'prune'),
    )
    .map((event) => event.id);
  const retainedIds = new Set(
    events.map((event) => event.id).filter((id) => !pruneIds.includes(id)),
  );
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

async function priorityEventIds(
  events: readonly {
    id: string;
    pubkey: string;
    kind: number;
    created_at: number;
  }[],
): Promise<Set<string>> {
  const ids = pinnedEventIds();
  latestByKey(
    events.filter((event) => event.kind === 0),
    (event) => event.pubkey,
  ).forEach((event) => ids.add(event.id));
  const accounts = await browserDb()
    .accounts.toArray()
    .catch(() => []);
  const accountPubkeys = new Set(accounts.map((account) => account.pubkey));
  latestByKey(
    events.filter(
      (event) => event.kind === 3 && accountPubkeys.has(event.pubkey),
    ),
    (event) => event.pubkey,
  ).forEach((event) => ids.add(event.id));
  return ids;
}

function latestByKey<T extends { created_at: number }>(
  events: readonly T[],
  key: (event: T) => string,
): T[] {
  const byKey = new Map<string, T>();
  for (const event of events) {
    const current = byKey.get(key(event));
    if (!current || current.created_at < event.created_at)
      byKey.set(key(event), event);
  }
  return [...byKey.values()];
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
  const stale = (await browserDb().feedCursors.toArray())
    .filter((cursor) => {
      const ids = [cursor.oldest?.id, cursor.newest?.id].filter(
        (id): id is string => Boolean(id),
      );
      return ids.some((id) => !retainedIds.has(id));
    })
    .map((cursor) => ({ id: cursor.id, feedKey: cursor.feedKey }));
  if (stale.length === 0) return;
  await browserDb().feedCursors.bulkDelete(stale.map((cursor) => cursor.id));
  await deleteFeedCoverageForFeeds(stale.map((cursor) => cursor.feedKey));
}
