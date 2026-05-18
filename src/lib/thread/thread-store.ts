import { browserDb } from '../storage/browser-db';
import { compareEventsDesc, type NostrEvent } from '../protocol';

export type ThreadItem = {
  readonly event: NostrEvent;
  readonly relays: readonly string[];
};

export async function loadCachedThread(eventId: string): Promise<ThreadItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  const events = await browserDb()
    .events.toArray()
    .catch(() => []);
  return events
    .filter(
      (event) =>
        event.id === eventId ||
        event.tags.some((tag) => tag[0] === 'e' && tag[1] === eventId),
    )
    .sort(compareEventsDesc)
    .map((event) => ({ event, relays: ['cache'] }));
}

export async function storeThreadEvent(event: NostrEvent): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await browserDb()
    .events.put(event)
    .catch(() => undefined);
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
