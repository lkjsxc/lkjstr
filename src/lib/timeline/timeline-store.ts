import { browserDb } from '../storage/browser-db';
import { compareEventsDesc, type NostrEvent } from '../protocol';

export type TimelineItem = {
  readonly event: NostrEvent;
  readonly relays: readonly string[];
};

const memoryEvents = new Map<string, NostrEvent>();

export async function loadCachedTimeline(
  limit: number,
): Promise<TimelineItem[]> {
  if (typeof indexedDB === 'undefined') return memoryTimeline(limit);
  const events = await browserDb()
    .events.where('kind')
    .equals(1)
    .reverse()
    .sortBy('created_at')
    .catch(() => [...memoryEvents.values()]);
  return events
    .sort(compareEventsDesc)
    .slice(0, limit)
    .map((event) => ({ event, relays: ['cache'] }));
}

export async function storeTimelineEvent(event: NostrEvent): Promise<void> {
  memoryEvents.set(event.id, event);
  if (typeof indexedDB === 'undefined') return;
  await browserDb()
    .events.put(event)
    .catch(() => undefined);
}

export function mergeTimelineItems(
  cached: readonly TimelineItem[],
  live: readonly TimelineItem[],
  limit: number,
): TimelineItem[] {
  const byId = new Map<string, TimelineItem>();
  for (const item of [...cached, ...live]) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeItem(existing, item) : item);
  }
  return [...byId.values()]
    .sort((a, b) => compareEventsDesc(a.event, b.event))
    .slice(0, limit);
}

function mergeItem(a: TimelineItem, b: TimelineItem): TimelineItem {
  return {
    event: a.event.created_at >= b.event.created_at ? a.event : b.event,
    relays: [...new Set([...a.relays, ...b.relays])],
  };
}

function memoryTimeline(limit: number): TimelineItem[] {
  return [...memoryEvents.values()]
    .sort(compareEventsDesc)
    .slice(0, limit)
    .map((event) => ({ event, relays: ['cache'] }));
}
