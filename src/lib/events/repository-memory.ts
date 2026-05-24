import { compareEventsDesc } from '../protocol';
import { createBoundedMap } from '../fp/bounded-map';
import { feedDisplayKinds } from './feed-kinds';
import type {
  EventRelayReceipt,
  EventTagRow,
  FeedCursor,
  FeedQuery,
  StoredEvent,
} from './types';
import { afterCursor, before, beforeCursor } from './repository-shared';

const fallbackLimit = 5000;
const fallbackIndexLimit = fallbackLimit * 8;
const memoryEvents = createBoundedMap<string, StoredEvent>({
  maxSize: fallbackLimit,
});
const memoryReceipts = createBoundedMap<string, EventRelayReceipt>({
  maxSize: fallbackIndexLimit,
});
const memoryTags = createBoundedMap<string, EventTagRow>({
  maxSize: fallbackIndexLimit,
});
export const memoryCursors = createBoundedMap<string, FeedCursor>({
  maxSize: 1000,
});

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

export function memoryEventsByTagValues(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValues: readonly string[],
): StoredEvent[] {
  const wanted = new Set(tagValues);
  const ids = [...memoryTags.values()]
    .filter((row) => row.tagName === tagName && wanted.has(row.tagValue))
    .map((row) => row.eventId);
  return memoryEventsByIds([...new Set(ids)]).sort(compareEventsDesc);
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
}

function matchesFeed(event: StoredEvent, query: FeedQuery): boolean {
  const displayKinds = query.kinds ?? feedDisplayKinds;
  if (!before(event, query.until)) return false;
  if (!beforeCursor(event, query.before)) return false;
  if (!afterCursor(event, query.after)) return false;
  if (query.kind === 'global') return displayKinds.includes(event.kind);
  if (query.kind === 'home')
    return (
      displayKinds.includes(event.kind) &&
      Boolean(query.authors?.includes(event.pubkey))
    );
  if (query.kind === 'profile')
    return (
      displayKinds.includes(event.kind) &&
      Boolean(query.authors?.includes(event.pubkey))
    );
  if (query.kind === 'thread')
    return (
      event.id === query.eventId ||
      event.tags.some((tag) => tag[0] === 'e' && tag[1] === query.eventId)
    );
  return false;
}

export function clearMemoryRepository(): void {
  memoryEvents.clear();
  memoryReceipts.clear();
  memoryTags.clear();
  memoryCursors.clear();
}
