import type { FeedEvent } from '../events/types';
import { eventRelays } from '../relays/progressive-read-provenance';
import type { ProgressiveReadSnapshot } from '../relays/progressive-read-types';
import { readyWithEventsState, type TimelineState } from './timeline-state';
import { mergeTimelineItems, type TimelineItem } from './timeline-store';

export function timelineItemsFromSnapshot(
  snapshot: ProgressiveReadSnapshot,
): TimelineItem[] {
  return feedEventsFromProgressiveSnapshot(snapshot);
}

export function feedEventsFromProgressiveSnapshot(
  snapshot: ProgressiveReadSnapshot,
): FeedEvent[] {
  return snapshot.events.map((item) => ({
    event: item.event,
    relays: eventRelays(snapshot.events, item.event.id),
  }));
}

export function mergeProgressiveTimelineItems(
  existing: readonly TimelineItem[],
  snapshot: ProgressiveReadSnapshot,
  limit: number,
): TimelineItem[] {
  return mergeTimelineItems(
    existing,
    timelineItemsFromSnapshot(snapshot),
    limit,
  );
}

export function progressiveStatusText(
  status: ProgressiveReadSnapshot['status'] | undefined,
): string {
  if (status === 'partial') return 'Loading more relay results...';
  if (status === 'incomplete') return 'Some relays did not finish.';
  if (status === 'failed') return 'Relay read failed.';
  return '';
}

export function progressiveTimelinePatch(
  state: TimelineState,
  items: readonly TimelineItem[],
  snapshot: ProgressiveReadSnapshot,
): Partial<TimelineState> {
  if (items.length === 0 && !snapshot.final)
    return {
      relayReadStatus: snapshot.status,
      relayReadStatusText: progressiveStatusText(snapshot.status),
    };
  return {
    ...(items.length > 0 ? readyWithEventsState(state, items) : state),
    loading: !snapshot.final,
    relayReadStatus: snapshot.status,
    relayReadStatusText: progressiveStatusText(snapshot.status),
  };
}
