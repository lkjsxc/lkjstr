import type { NostrFilter } from '../protocol';
import { defaultReadPageMaxEvents } from '../relays/subscription-manager';
import {
  cachedRelayInformation,
  relayRequestLimit,
} from '../relays/relay-info';

export type LimitedRelayFilters = {
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
};

export async function limitedRelayFilterGroups(
  relays: readonly string[],
  filters: readonly NostrFilter[],
  pageSize: number,
): Promise<LimitedRelayFilters[]> {
  const groups = new Map<string, LimitedRelayFilters>();
  for (const relay of relays) {
    const info = cachedRelayInformation(relay)?.info;
    const limited = filters.map((filter) => ({
      ...filter,
      limit: relayRequestLimit(filter.limit ?? pageSize, info),
    }));
    const key = JSON.stringify(limited.map((item) => item.limit));
    const current = groups.get(key);
    groups.set(key, {
      relays: [...(current?.relays ?? []), relay],
      filters: current?.filters ?? limited,
    });
  }
  return [...groups.values()];
}

export function relayReadEventCap(
  filters: readonly NostrFilter[],
  relayCount: number,
  pageSize: number,
  safetyCeiling = defaultReadPageMaxEvents,
): number {
  const filterBudget = filters.reduce(
    (sum, filter) => sum + Math.max(1, filter.limit ?? pageSize),
    0,
  );
  const relays = Math.max(1, relayCount);
  return Math.min(
    Math.max(1, safetyCeiling),
    Math.max(pageSize, filterBudget * relays + pageSize),
  );
}
