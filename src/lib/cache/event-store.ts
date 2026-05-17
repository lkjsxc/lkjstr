import type { NostrEvent } from '../protocol';

export class EventStore {
  #events = new Map<string, NostrEvent>();

  upsert(event: NostrEvent): void {
    this.#events.set(event.id, event);
  }

  bulkUpsert(events: readonly NostrEvent[]): void {
    events.forEach((event) => this.upsert(event));
  }

  list(): NostrEvent[] {
    return [...this.#events.values()];
  }

  clear(): void {
    this.#events.clear();
  }
}
