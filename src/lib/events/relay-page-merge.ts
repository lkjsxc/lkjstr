import { compareEventsDesc } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type { FeedEvent } from './types';

export function mergePoolEvents(events: readonly PoolEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of events) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, {
      event: existing?.event ?? item.event,
      relays: [...new Set([...(existing?.relays ?? []), item.relay])].sort(),
    });
  }
  return [...byId.values()];
}

export function mergeFeedEvents(events: readonly FeedEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of events) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, {
      event: existing?.event ?? item.event,
      relays: [
        ...new Set([...(existing?.relays ?? []), ...item.relays]),
      ].sort(),
    });
  }
  return [...byId.values()];
}

export function sortFeedEvents(events: readonly FeedEvent[]): FeedEvent[] {
  return [...events].sort((a, b) => compareEventsDesc(a.event, b.event));
}
