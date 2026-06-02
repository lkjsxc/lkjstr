import {
  putFeedCursorWithLedger,
  putStoredEventWithLedger,
  readStoredEventRow,
  readStoredEventRows,
} from '../storage/repositories/events-store';
import { compareEventsDesc, matchesFilter, type NostrEvent } from '../protocol';
import { cursorPoint } from './feed-window';
import { indexedLatestByAuthorKind, indexedPage } from './repository-indexed';
import { indexedEventsMatching } from './repository-matching-indexed';
import {
  clearMemoryRepository,
  latestMemoryEventByAuthorKind,
  memoryCursors,
  memoryEvent,
  memoryEventsMatching,
  memoryEventsByIds,
  memoryPage,
  putMemory,
} from './repository-memory';
import { receipt, tagRows } from './repository-shared';
import { notifyActionCacheChanged } from './action-cache-signal';
import { normalizeStoredEvent } from './normalize';
import { storeRelayListSuggestionsFromEvent } from '../relays/relay-list-suggestions';
import { storeRoutesFromEvent } from '../relays/relay-route-events';
import { countRuntime } from '../app/runtime-counters';
import { scheduleCacheCompactionAfterWrite } from '../cache/compaction-scheduler';
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
  if (existing && sameRelays(existing.relayUrls, relays)) return stored;
  countRuntime('timeline', 'storedEvents');
  await putStoredEventWithLedger({ event, stored, receipts, tags, receivedAt });
  await storeRelayListSuggestionsFromEvent(event);
  await storeRoutesFromEvent(event, relays);
  notifyActionCacheChanged(event);
  scheduleCacheCompactionAfterWrite();
  return stored;
}

export async function queryFeed(query: FeedQuery): Promise<FeedPage> {
  const limit = query.limit ?? 50;
  const records =
    (await indexedPage(query, limit + 1).catch(() => undefined)) ??
    memoryPage(query, limit + 1);
  const items = records.slice(0, limit).map(toFeedEvent);
  const cursor = cursorFor(query, items);
  if (cursor) await saveCursor(cursor);
  return { items, cursor, hasMore: records.length > limit };
}

export async function lookupEvent(id: string): Promise<FeedEvent | undefined> {
  const event = await readStoredEventRow(id, memoryEvent(id));
  return event ? toFeedEvent(event) : undefined;
}

export async function lookupEvents(
  ids: readonly string[],
): Promise<FeedEvent[]> {
  const unique = [...new Set(ids)];
  const events = await readStoredEventRows(unique, memoryEventsByIds(unique));
  return events
    .filter((event): event is StoredEvent => Boolean(event))
    .map((event) => toFeedEvent(event));
}

export { eventsByTagValue, eventsByTagValues } from './repository-tags';

export async function latestEventByAuthorKind(
  pubkey: string,
  kind: number,
): Promise<FeedEvent | undefined> {
  const event =
    (await indexedLatestByAuthorKind(pubkey, kind).catch(() => undefined)) ??
    latestMemoryEventByAuthorKind(pubkey, kind);
  return event ? toFeedEvent(event) : undefined;
}

export async function eventsMatching(
  filters: readonly Parameters<typeof matchesFilter>[1][],
  options: { readonly limit?: number } = {},
): Promise<FeedEvent[]> {
  const limit = Math.max(
    1,
    Math.min(
      1000,
      options.limit ??
        Math.max(...filters.map((filter) => filter.limit ?? 500), 1),
    ),
  );
  const events =
    (await indexedEventsMatching(filters, limit).catch(() => undefined)) ??
    memoryEventsMatching(filters, limit);
  return events.sort(compareEventsDesc).map(toFeedEvent);
}

export function feedKey(query: FeedQuery): string {
  return JSON.stringify({
    kind: query.kind,
    kinds: query.kinds ? [...query.kinds].sort((a, b) => a - b) : undefined,
    authors: query.authors ? [...query.authors].sort() : undefined,
    eventId: query.eventId,
  });
}

async function existingEvent(id: string): Promise<StoredEvent | undefined> {
  const cached = memoryEvent(id);
  if (cached) return normalizeStoredEvent(cached);
  const event = await readStoredEventRow(id, undefined);
  return event ? normalizeStoredEvent(event) : undefined;
}

function toFeedEvent(event: StoredEvent): FeedEvent {
  const normalized = normalizeStoredEvent(event);
  return {
    event: normalized,
    relays: normalized.relayUrls,
  };
}

function sameRelays(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  const seen = new Set(left);
  return right.every((relayUrl) => seen.has(relayUrl));
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
  await putFeedCursorWithLedger(cursor);
}

export function clearEventRepositoryForTests(): void {
  clearMemoryRepository();
}
