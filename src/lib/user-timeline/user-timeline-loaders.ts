import { cursorPoint, feedPageSize } from '$lib/events/feed-window';
import type { FeedCursorPoint } from '$lib/events/types';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import type { OnProgressiveReadSnapshot } from '$lib/relays/progressive-read-types';
import {
  loadInitialTimelinePage,
  loadOlderTimelinePage,
} from '$lib/timeline/timeline-runtime-paging';
import type { TimelineItem } from '$lib/timeline/timeline-store';

export function readInitialUserTimeline(input: {
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly owner: string;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
}) {
  return loadInitialTimelinePage({
    surface: 'user-timeline',
    authors: input.authors,
    relays: input.relays,
    owner: input.owner,
    pageSize: feedPageSize,
    subscriptions: input.subscriptions,
    signal: input.signal,
    onSnapshot: input.onSnapshot,
  });
}

export function readOlderUserTimeline(input: {
  readonly items: readonly TimelineItem[];
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly owner: string;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
  readonly cursor?: FeedCursorPoint;
}) {
  const cursor = input.cursor ?? cursorPoint(input.items.at(-1));
  if (!cursor) return Promise.resolve(undefined);
  return loadOlderTimelinePage({
    surface: 'user-timeline',
    items: input.items,
    authors: input.authors,
    relays: input.relays,
    owner: input.owner,
    cursor,
    pageSize: feedPageSize,
    subscriptions: input.subscriptions,
    signal: input.signal,
  });
}
