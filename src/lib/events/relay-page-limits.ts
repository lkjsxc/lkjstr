import type { NostrFilter } from '../protocol';
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
