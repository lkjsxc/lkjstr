import { compareEventsDesc, type NostrEvent } from '../protocol';
import { feedPageSize } from '../events/feed-window';
import { queryFeed, upsertEvent } from '../events/repository';

export type ThreadItem = {
  readonly event: NostrEvent;
  readonly relays: readonly string[];
};

export async function loadCachedThread(eventId: string): Promise<ThreadItem[]> {
  return [
    ...(await queryFeed({ kind: 'thread', eventId, limit: feedPageSize }))
      .items,
  ];
}

export async function storeThreadEvent(
  event: NostrEvent,
  relays: readonly string[] = [],
): Promise<void> {
  await upsertEvent(event, relays);
}

export function mergeThreadItems(
  a: readonly ThreadItem[],
  b: readonly ThreadItem[],
): ThreadItem[] {
  const byId = new Map<string, ThreadItem>();
  for (const item of [...a, ...b]) {
    const existing = byId.get(item.event.id);
    const relays = existing
      ? [...new Set([...existing.relays, ...item.relays])]
      : item.relays;
    byId.set(item.event.id, { event: item.event, relays });
  }
  return [...byId.values()].sort((left, right) =>
    compareEventsDesc(left.event, right.event),
  );
}
