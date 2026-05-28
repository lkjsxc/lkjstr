import type { PoolEvent } from './relay-pool';
import { sortPoolEvents } from './progressive-read-ordering';

export function mergeProgressiveEvents(
  current: readonly PoolEvent[],
  incoming: readonly PoolEvent[],
): PoolEvent[] {
  const byId = new Map<string, PoolEvent>();
  for (const item of [...current, ...incoming]) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeReceipt(existing, item) : item);
  }
  return sortPoolEvents([...byId.values()]);
}

function mergeReceipt(a: PoolEvent, b: PoolEvent): PoolEvent {
  return {
    event: a.event.created_at >= b.event.created_at ? a.event : b.event,
    relay: [...new Set([...a.relay.split(' '), b.relay])].sort().join(' '),
    subId: a.subId,
  };
}

export function eventRelays(
  events: readonly PoolEvent[],
  id: string,
): string[] {
  return events
    .filter((item) => item.event.id === id)
    .flatMap((item) => item.relay.split(' '))
    .filter(Boolean)
    .sort();
}
