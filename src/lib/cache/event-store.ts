import type { NostrEvent } from '../protocol';

export type EventStore = ReturnType<typeof createEventStore>;

export function createEventStore() {
  const events = new Map<string, NostrEvent>();
  return {
    upsert: (event: NostrEvent): void => {
      events.set(event.id, event);
    },
    bulkUpsert: (items: readonly NostrEvent[]): void => {
      items.forEach((event) => events.set(event.id, event));
    },
    list: (): NostrEvent[] => [...events.values()],
    clear: (): void => events.clear(),
  };
}
