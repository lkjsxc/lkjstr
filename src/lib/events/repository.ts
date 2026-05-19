import { browserDb } from '../storage/browser-db';
import { compareEventsDesc, matchesFilter, type NostrEvent } from '../protocol';
import { indexedPage } from './repository-indexed';
import {
  allMemoryEvents,
  clearMemoryRepository,
  memoryCursors,
  memoryEvent,
  memoryPage,
  putMemory,
} from './repository-memory';
import { receipt, tagRows } from './repository-shared';
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
  const stored = { ...event, receivedAt, relayUrls: relays };
  const receipts = relays.map((relayUrl) =>
    receipt(event.id, relayUrl, receivedAt),
  );
  const tags = tagRows(event);
  if (typeof indexedDB === 'undefined') {
    putMemory(stored, receipts, tags);
    return stored;
  }
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
  return stored;
}

export async function queryFeed(query: FeedQuery): Promise<FeedPage> {
  const limit = query.limit ?? 50;
  const records =
    typeof indexedDB === 'undefined'
      ? memoryPage(query, limit + 1)
      : await indexedPage(query, limit + 1).catch(() =>
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
  if (typeof indexedDB === 'undefined') return allMemoryEvents();
  const records = await browserDb()
    .events.toArray()
    .catch(() => allMemoryEvents());
  return records.map((event) => ({
    ...event,
    receivedAt: event.receivedAt ?? 0,
    relayUrls: event.relayUrls ?? ['cache'],
  }));
}

async function existingEvent(id: string): Promise<StoredEvent | undefined> {
  if (typeof indexedDB === 'undefined') return memoryEvent(id);
  return browserDb()
    .events.get(id)
    .catch(() => undefined);
}

function toFeedEvent(event: StoredEvent): FeedEvent {
  return {
    event,
    relays: event.relayUrls.length > 0 ? event.relayUrls : ['cache'],
  };
}

function cursorFor(
  query: FeedQuery,
  items: readonly FeedEvent[],
): FeedCursor | undefined {
  const last = items.at(-1)?.event;
  if (!last) return undefined;
  return {
    id: feedKey(query),
    feedKey: feedKey(query),
    until: last.created_at,
    updatedAt: Date.now(),
  };
}

async function saveCursor(cursor: FeedCursor): Promise<void> {
  memoryCursors.set(cursor.id, cursor);
  if (typeof indexedDB === 'undefined') return;
  await browserDb()
    .feedCursors.put(cursor)
    .catch(() => undefined);
}

export function clearEventRepositoryForTests(): void {
  clearMemoryRepository();
}
