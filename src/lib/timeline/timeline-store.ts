import { compareEventsDesc, type NostrEvent } from '../protocol';
import { isFeedDisplayKind } from '../events/feed-kinds';
import {
  latestEventByAuthorKind,
  queryFeed,
  upsertEvent,
} from '../events/repository';
import { createBoundedMap } from '../fp/bounded-map';
import { indexedDbAvailable } from '../storage/safe-storage';
import { latestFollowList } from './follow-list';

export type TimelineItem = {
  readonly event: NostrEvent;
  readonly relays: readonly string[];
};

const memoryEvents = createBoundedMap<string, NostrEvent>({ maxSize: 2000 });

export async function loadCachedTimeline(
  limit: number,
  authors?: readonly string[],
): Promise<TimelineItem[]> {
  if (!indexedDbAvailable()) return memoryTimeline(limit, authors);
  return [
    ...(
      await queryFeed({
        kind: authors ? 'home' : 'global',
        authors,
        limit,
      })
    ).items,
  ];
}

export async function loadCachedFollowList(
  pubkey: string,
): Promise<NostrEvent | undefined> {
  if (!indexedDbAvailable())
    return latestFollowList([...memoryEvents.values()], pubkey);
  return (await latestEventByAuthorKind(pubkey, 3))?.event;
}

export async function storeTimelineEvent(event: NostrEvent): Promise<void> {
  memoryEvents.set(event.id, event);
  await upsertEvent(event);
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

function memoryTimeline(
  limit: number,
  authors?: readonly string[],
): TimelineItem[] {
  const allowed = authors ? new Set(authors) : undefined;
  return [...memoryEvents.values()]
    .filter((event) => isFeedDisplayKind(event.kind))
    .filter((event) => !allowed || allowed.has(event.pubkey))
    .sort(compareEventsDesc)
    .slice(0, limit)
    .map((event) => ({ event, relays: ['cache'] }));
}
