import {
  compareEventsDesc,
  matchesAnyFilter,
  type NostrEvent,
  type NostrFilter,
} from '../protocol';

export function mergeTimeline(
  cached: readonly NostrEvent[],
  live: readonly NostrEvent[],
  filters: readonly NostrFilter[],
  limit = 100,
): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  for (const event of [...cached, ...live]) {
    if (filters.length > 0 && !matchesAnyFilter(event, filters)) continue;
    byId.set(event.id, event);
  }
  return [...byId.values()].sort(compareEventsDesc).slice(0, limit);
}
