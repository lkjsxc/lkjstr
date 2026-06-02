import {
  indexedEventsByTagValue,
  indexedEventsByTagValues,
} from './repository-indexed';
import {
  memoryEventsByTagValue,
  memoryEventsByTagValues,
} from './repository-memory';
import { normalizeStoredEvent } from './normalize';
import type { FeedEvent, StoredEvent } from './types';

type TagName = 'e' | 'p' | 'q' | 'a';

export async function eventsByTagValue(
  tagName: TagName,
  tagValue: string,
  limit = 500,
): Promise<FeedEvent[]> {
  const events =
    (await indexedEventsByTagValue(tagName, tagValue, limit).catch(
      () => undefined,
    )) ?? memoryEventsByTagValue(tagName, tagValue).slice(0, limit);
  return events.map(toFeedEvent);
}

export async function eventsByTagValues(
  tagName: TagName,
  tagValues: readonly string[],
  limit = 500,
): Promise<FeedEvent[]> {
  const values = [...new Set(tagValues)];
  if (values.length === 0) return [];
  const events =
    (await indexedEventsByTagValues(tagName, values, limit).catch(
      () => undefined,
    )) ?? memoryEventsByTagValues(tagName, values).slice(0, limit);
  return events.map(toFeedEvent);
}

function toFeedEvent(event: StoredEvent): FeedEvent {
  const normalized = normalizeStoredEvent(event);
  return { event: normalized, relays: normalized.relayUrls };
}
