import {
  loadCachedTimeline,
  mergeTimelineItems,
  type TimelineItem,
} from '$lib/timeline/timeline-store';

export function loadCachedUserTimeline(input: {
  readonly authors: readonly string[];
  readonly limit: number;
}): Promise<TimelineItem[]> {
  return loadCachedTimeline(input.limit, input.authors);
}

export function mergeUserTimelineItems(input: {
  readonly current: readonly TimelineItem[];
  readonly incoming: readonly TimelineItem[];
  readonly limit: number;
}): TimelineItem[] {
  return mergeTimelineItems(input.current, input.incoming, input.limit);
}
