import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
  indexedDbAvailable,
} from '../storage/safe-storage';
import { compareEventsDesc, matchesFilter, type NostrEvent } from '../protocol';
import { cursorPoint } from './feed-window';
import { indexedLatestByAuthorKind, indexedPage } from './repository-indexed';
import {
  allMemoryEvents,
  clearMemoryRepository,
  latestMemoryEventByAuthorKind,
  memoryCursors,
  memoryEvent,
  memoryPage,
  putMemory,
} from './repository-memory';
import { receipt, tagRows } from './repository-shared';
import { normalizeStoredEvent } from './normalize';
import type {
  FeedCursor,
  FeedEvent,
  FeedPage,
  FeedQuery,
  StoredEvent,
} from './types';

export async function upsertEvent(
  event: NostrEvent,
  relayUrls: readonly string[] = [],
  receivedAt = Date.now(),
): Promise<StoredEvent> {
  const existing = await existingEvent(event.id);
  const relays = [...new Set([...(existing?.relayUrls ?? []), ...relayUrls])];
  const stored = normalizeStoredEvent({
    ...event,
    receivedAt,
    relayUrls: relays,
  });
  const receipts = relays.map((relayUrl) =>
    receipt(event.id, relayUrl, receivedAt),
  );
  const tags = tagRows(event);
  putMemory(stored, receipts, tags);
  if (!indexedDbAvailable()) {
    return stored;
  }
  await bestEffortStorageWrite(async () => {
    await browserDb().transaction(
      'rw',
      browserDb().events,
      browserDb().eventRelays,
      browserDb().eventTags,
      async () => {
        await browserDb().events.put(stored);
        await browserDb().eventRelays.bulkPut(receipts);
        await browserDb().eventTags.where('eventId').equals(event.id).delete();
        if (tags.length > 0) await browserDb().eventTags.bulkPut(tags);
      },
    );
  });
  return stored;
}

export async function queryFeed(query: FeedQuery): Promise<FeedPage> {
  const limit = query.limit ?? 50;
  const records = await boundedStorageRead(
    () => indexedPage(query, limit + 1),
    memoryPage(query, limit + 1),
  );
  const items = records.slice(0, limit).map(toFeedEvent);
  const cursor = cursorFor(query, items);
  if (cursor) await saveCursor(cursor);
  return { items, cursor, hasMore: records.length > limit };
}

export async function lookupEvent(id: string): Promise<FeedEvent | undefined> {
  const event = (await allEvents()).find((item) => item.id === id);
  return event ? toFeedEvent(event) : undefined;
}

export async function latestEventByAuthorKind(
  pubkey: string,
  kind: number,
): Promise<FeedEvent | undefined> {
  const event = await boundedStorageRead(
    () => indexedLatestByAuthorKind(pubkey, kind),
    latestMemoryEventByAuthorKind(pubkey, kind),
  );
  return event ? toFeedEvent(event) : undefined;
}

export async function eventsMatching(
  filters: readonly Parameters<typeof matchesFilter>[1][],
): Promise<FeedEvent[]> {
  return (await allEvents())
    .filter((event) => filters.some((filter) => matchesFilter(event, filter)))
    .sort(compareEventsDesc)
    .map(toFeedEvent);
}

export function feedKey(query: FeedQuery): string {
  return JSON.stringify({
    kind: query.kind,
    authors: query.authors ? [...query.authors].sort() : undefined,
    eventId: query.eventId,
  });
}

async function allEvents(): Promise<StoredEvent[]> {
  const records = await boundedStorageRead(
    () => browserDb().events.toArray(),
    allMemoryEvents(),
  );
  return records.map(normalizeStoredEvent);
}

async function existingEvent(id: string): Promise<StoredEvent | undefined> {
  const event = await boundedStorageRead(
    () => browserDb().events.get(id),
    memoryEvent(id),
  );
  return event ? normalizeStoredEvent(event) : undefined;
}

function toFeedEvent(event: StoredEvent): FeedEvent {
  const normalized = normalizeStoredEvent(event);
  return {
    event: normalized,
    relays: normalized.relayUrls,
  };
}

function cursorFor(
  query: FeedQuery,
  items: readonly FeedEvent[],
): FeedCursor | undefined {
  const last = items.at(-1)?.event;
  const first = items.at(0);
  if (!last) return undefined;
  return {
    id: feedKey(query),
    feedKey: feedKey(query),
    until: last.created_at,
    newest: first ? cursorPoint({ event: first.event }) : undefined,
    oldest: cursorPoint({ event: last }),
    updatedAt: Date.now(),
  };
}

async function saveCursor(cursor: FeedCursor): Promise<void> {
  memoryCursors.set(cursor.id, cursor);
  await bestEffortStorageWrite(() => browserDb().feedCursors.put(cursor));
}

export function clearEventRepositoryForTests(): void {
  clearMemoryRepository();
}
