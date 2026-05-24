import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import { retainedCandidateLimit } from './relay-page-scan-items';

export function retainedRawCandidates(
  events: readonly PoolEvent[],
  pageSize: number,
): PoolEvent[] {
  return [...events]
    .sort((a, b) => {
      const time = b.event.created_at - a.event.created_at;
      return time === 0 ? b.event.id.localeCompare(a.event.id) : time;
    })
    .slice(0, retainedCandidateLimit(pageSize));
}

export function scaleFilters(
  filters: readonly NostrFilter[],
  multiplier: number,
): NostrFilter[] {
  return filters.map((filter) => ({
    ...filter,
    limit: (filter.limit ?? 1) * multiplier,
  }));
}
