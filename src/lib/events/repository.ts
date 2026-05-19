import { browserDb } from '../storage/browser-db';
import { compareEventsDesc, matchesFilter, type NostrEvent } from '../protocol';
import type {
  EventRelayReceipt,
  FeedCursor,
  FeedEvent,
  FeedPage,
  FeedQuery,
  StoredEvent,
} from './types';

const memoryEvents = new Map<string, StoredEvent>();
const memoryReceipts = new Map<string, EventRelayReceipt>();
const memoryCursors = new Map<string, FeedCursor>();

export async function upsertEvent(
  event: NostrEvent,
  relayUrls: readonly string[] = [],
  receivedAt = Date.now(),
): Promise<StoredEvent> {
  const existing = memoryEvents.get(event.id);
  const relays = [...new Set([...(existing?.relayUrls ?? []), ...relayUrls])];
  const stored = { ...event, receivedAt, relayUrls: relays };
  memoryEvents.set(event.id, stored);
  for (const relayUrl of relays) upsertReceipt(event.id, relayUrl, receivedAt);
  if (typeof indexedDB === 'undefined') return stored;
  await browserDb()
    .events.put(stored)
    .catch(() => undefined);
  await browserDb()
    .eventRelays.bulkPut(
      relays.map((relayUrl) => receipt(event.id, relayUrl, receivedAt)),
    )
    .catch(() => undefined);
  return stored;
}

export async function queryFeed(query: FeedQuery): Promise<FeedPage> {
  const limit = query.limit ?? 50;
  const events = await allEvents();
  const items = events
    .filter((event) => matchesFeed(event, query))
    .sort(compareEventsDesc)
    .slice(0, limit)
    .map(toFeedEvent);
  const cursor = cursorFor(query, items);
  if (cursor) await saveCursor(cursor);
  return { items, cursor };
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
  if (typeof indexedDB === 'undefined') return [...memoryEvents.values()];
  const records = await browserDb()
    .events.toArray()
    .catch(() => [...memoryEvents.values()]);
  return records.map((event) => ({
    ...event,
    receivedAt: event.receivedAt ?? 0,
    relayUrls: event.relayUrls ?? ['cache'],
  }));
}

function matchesFeed(event: StoredEvent, query: FeedQuery): boolean {
  if (query.until !== undefined && event.created_at >= query.until)
    return false;
  if (query.kind === 'global') return event.kind === 1;
  if (query.kind === 'home')
    return event.kind === 1 && Boolean(query.authors?.includes(event.pubkey));
  if (query.kind === 'profile')
    return event.kind === 1 && Boolean(query.authors?.includes(event.pubkey));
  if (query.kind === 'thread')
    return (
      event.id === query.eventId ||
      event.tags.some((tag) => tag[0] === 'e' && tag[1] === query.eventId)
    );
  return false;
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

function upsertReceipt(eventId: string, relayUrl: string, receivedAt: number) {
  memoryReceipts.set(
    receiptId(eventId, relayUrl),
    receipt(eventId, relayUrl, receivedAt),
  );
}

function receipt(
  eventId: string,
  relayUrl: string,
  receivedAt: number,
): EventRelayReceipt {
  return { id: receiptId(eventId, relayUrl), eventId, relayUrl, receivedAt };
}

function receiptId(eventId: string, relayUrl: string): string {
  return `${eventId}:${relayUrl}`;
}
