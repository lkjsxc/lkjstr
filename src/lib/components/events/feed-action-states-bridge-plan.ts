import type { EventActionState } from '$lib/events/action-state';
import type { FeedEvent } from '$lib/events/types';

export type FeedActionOptimisticScope = {
  readonly pubkey: string;
  readonly optimistic: Map<string, EventActionState>;
};

export function scopedFeedActionOptimistic(
  current: FeedActionOptimisticScope | undefined,
  pubkey: string,
  visibleItems: readonly FeedEvent[],
): FeedActionOptimisticScope {
  if (current?.pubkey !== pubkey) {
    return { pubkey, optimistic: new Map() };
  }
  const visible = new Set(visibleItems.map((item) => item.event.id));
  return {
    pubkey,
    optimistic: new Map(
      [...current.optimistic].filter(([eventId]) => visible.has(eventId)),
    ),
  };
}
