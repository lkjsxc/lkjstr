import { compareEventsDesc } from '../protocol';
import type {
  EventRelayReceipt,
  EventTagRow,
  FeedCursor,
  FeedQuery,
  StoredEvent,
} from './types';
import { afterCursor, before, beforeCursor } from './repository-shared';

const fallbackLimit = 5000;
const memoryEvents = new Map<string, StoredEvent>();
const memoryReceipts = new Map<string, EventRelayReceipt>();
const memoryTags = new Map<string, EventTagRow>();
export const memoryCursors = new Map<string, FeedCursor>();

export function memoryEvent(id: string): StoredEvent | undefined {
  return memoryEvents.get(id);
}

export function memoryEventsByIds(ids: readonly string[]): StoredEvent[] {
  return ids.flatMap((id) => {
    const event = memoryEvents.get(id);
    return event ? [event] : [];
  });
}

export function allMemoryEvents(): StoredEvent[] {
  return [...memoryEvents.values()];
}

export function memoryEventsByTagValue(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValue: string,
): StoredEvent[] {
  const ids = [...memoryTags.values()]
    .filter((row) => row.tagName === tagName && row.tagValue === tagValue)
    .map((row) => row.eventId);
  return memoryEventsByIds([...new Set(ids)]);
}

export function latestMemoryEventByAuthorKind(
  pubkey: string,
  kind: number,
): StoredEvent | undefined {
  return allMemoryEvents()
    .filter((event) => event.pubkey === pubkey && event.kind === kind)
    .sort(compareEventsDesc)[0];
}

export function memoryPage(query: FeedQuery, limit: number): StoredEvent[] {
  return allMemoryEvents()
    .filter((event) => matchesFeed(event, query))
    .sort(compareEventsDesc)
    .slice(0, limit);
}

export function putMemory(
  event: StoredEvent,
  receipts: readonly EventRelayReceipt[],
  tags: readonly EventTagRow[],
): void {
  memoryEvents.set(event.id, event);
  receipts.forEach((item) => memoryReceipts.set(item.id, item));
  [...memoryTags.values()]
    .filter((item) => item.eventId === event.id)
    .forEach((item) => memoryTags.delete(item.id));
  tags.forEach((item) => memoryTags.set(item.id, item));
  pruneMemory();
}

function matchesFeed(event: StoredEvent, query: FeedQuery): boolean {
  if (!before(event, query.until)) return false;
  if (!beforeCursor(event, query.before)) return false;
  if (!afterCursor(event, query.after)) return false;
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

function pruneMemory(): void {
  const overflow = memoryEvents.size - fallbackLimit;
  if (overflow <= 0) return;
  const ids = allMemoryEvents()
    .sort((a, b) => a.created_at - b.created_at)
    .slice(0, overflow)
    .map((event) => event.id);
  ids.forEach((id) => {
    memoryEvents.delete(id);
    deleteByEvent(memoryReceipts, id);
    deleteByEvent(memoryTags, id);
  });
}

function deleteByEvent<T extends { id: string; eventId: string }>(
  map: Map<string, T>,
  eventId: string,
): void {
  [...map.values()]
    .filter((item) => item.eventId === eventId)
    .forEach((item) => map.delete(item.id));
}

export function clearMemoryRepository(): void {
  memoryEvents.clear();
  memoryReceipts.clear();
  memoryTags.clear();
  memoryCursors.clear();
}
