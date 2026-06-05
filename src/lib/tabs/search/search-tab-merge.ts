import type { FeedEvent } from '$lib/events/types';

export function mergeSearchItems(
  current: readonly FeedEvent[],
  incoming: readonly FeedEvent[],
): FeedEvent[] {
  const ids = new Set<string>();
  return [...current, ...incoming]
    .filter((item) => {
      if (ids.has(item.event.id)) return false;
      ids.add(item.event.id);
      return true;
    })
    .sort((a, b) =>
      b.event.created_at === a.event.created_at
        ? a.event.id.localeCompare(b.event.id)
        : b.event.created_at - a.event.created_at,
    );
}
