import { compareEventsDesc, type NostrEvent } from '../protocol';
import type { FeedEvent } from './types';

export const feedPageSize = 30;
export const feedWindowSize = 180;
export const threadWindowSize = 240;
export const nearEndPixels = 900;
export const metadataPageLimit = 30;

export type WindowedFeed<T> = {
  readonly items: T[];
  readonly newerPruned: boolean;
};

export function mergeFeedWindow(
  existing: readonly FeedEvent[],
  incoming: readonly FeedEvent[],
  windowSize = feedWindowSize,
  keepOlder = false,
): WindowedFeed<FeedEvent> {
  const items = mergeFeedItems(existing, incoming);
  if (items.length <= windowSize) return { items, newerPruned: false };
  return keepOlder
    ? { items: items.slice(-windowSize), newerPruned: true }
    : { items: items.slice(0, windowSize), newerPruned: false };
}

export function mergeFeedItems(
  a: readonly FeedEvent[],
  b: readonly FeedEvent[],
): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of [...a, ...b]) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeItem(existing, item) : item);
  }
  return [...byId.values()].sort((left, right) =>
    compareEventsDesc(left.event, right.event),
  );
}

export function oldestCreatedAt(
  items: readonly { event: NostrEvent }[],
): number | undefined {
  return items.at(-1)?.event.created_at;
}

export function isNearEnd(
  scrollOffset: number,
  viewportSize: number,
  scrollSize: number,
  threshold = nearEndPixels,
): boolean {
  return scrollOffset + viewportSize >= scrollSize - threshold;
}

function mergeItem(a: FeedEvent, b: FeedEvent): FeedEvent {
  return {
    event: a.event.created_at >= b.event.created_at ? a.event : b.event,
    relays: [...new Set([...a.relays, ...b.relays])],
  };
}
