import { compareEventsNewestFirst } from '../events/event-order';
import type { NostrEvent } from '../protocol';
import type { TimelineItem } from './timeline-store';

export type TimelineReducerState = {
  readonly items: readonly TimelineItem[];
};

export function createEmptyTimelineReducerState(): TimelineReducerState {
  return { items: [] };
}

export function mergeTimelineReducerState(
  state: TimelineReducerState,
  incoming: readonly TimelineItem[],
  limit: number,
): TimelineReducerState {
  const byId = new Map(state.items.map((item) => [item.event.id, item]));
  for (const item of incoming) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeItem(existing, item) : item);
  }
  const items = [...byId.values()]
    .sort((left, right) =>
      compareEventsNewestFirst(left.event, right.event),
    )
    .slice(0, limit);
  return { items };
}

export function filterTimelineReducerByAuthors(
  state: TimelineReducerState,
  authors: readonly string[],
  limit: number,
): TimelineReducerState {
  if (authors.length === 0) return createEmptyTimelineReducerState();
  const allowed = new Set(authors);
  return mergeTimelineReducerState(
    createEmptyTimelineReducerState(),
    state.items.filter((item) => allowed.has(item.event.pubkey)),
    limit,
  );
}

export function timelineReducerFromEvents(
  events: readonly NostrEvent[],
  relay = 'cache',
  limit: number,
): TimelineReducerState {
  return mergeTimelineReducerState(
    createEmptyTimelineReducerState(),
    events.map((event) => ({ event, relays: [relay] })),
    limit,
  );
}

function mergeItem(a: TimelineItem, b: TimelineItem): TimelineItem {
  const event = compareEventsNewestFirst(a.event, b.event) <= 0 ? a.event : b.event;
  return { event, relays: [...new Set([...a.relays, ...b.relays])] };
}
