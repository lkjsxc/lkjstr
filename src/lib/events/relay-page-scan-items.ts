import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type { RelayGroupPageRequest } from './relay-page';
import { afterCursor, beforeCursor } from './repository-shared';
import {
  feedEventsInDisplayBounds,
  type FeedDisplayBounds,
} from './feed-display-bounds';
import { mergeFeedEvents, sortFeedEvents } from './relay-page-merge';
import type { FeedEvent } from './types';

export function pageScanItems(
  events: readonly FeedEvent[],
  request: Pick<RelayGroupPageRequest, 'before' | 'after' | 'pageSize'> & {
    readonly displayBounds?: FeedDisplayBounds;
  },
): FeedEvent[] {
  return scanCandidates(
    feedEventsInDisplayBounds(events, request.displayBounds),
    request.pageSize,
  )
    .filter((item) => beforeCursor(item.event, request.before))
    .filter((item) => afterCursor(item.event, request.after))
    .slice(0, request.pageSize);
}

export function scanCandidates(
  events: readonly FeedEvent[],
  pageSize: number,
): FeedEvent[] {
  return sortFeedEvents(mergeFeedEvents(events)).slice(
    0,
    retainedCandidateLimit(pageSize),
  );
}

export function retainedCandidateLimit(pageSize: number): number {
  return Math.max(pageSize, pageSize * 4);
}

export function denseScanResult(
  events: readonly PoolEvent[],
  filters: readonly NostrFilter[],
  pageSize: number,
): boolean {
  const limit = Math.max(
    1,
    Math.min(pageSize, ...filters.map((filter) => filter.limit ?? pageSize)),
  );
  const unique = new Set(events.map((item) => item.event.id)).size;
  return (
    events.length >= limit ||
    (events.length >= pageSize && unique < events.length)
  );
}

export function needsCursorSlack(
  raw: readonly PoolEvent[],
  itemCount: number,
  request: RelayGroupPageRequest,
): boolean {
  return (
    Boolean(request.before || request.after) &&
    raw.length > itemCount &&
    itemCount < request.pageSize
  );
}

export function slackFilters(filters: readonly NostrFilter[]): NostrFilter[] {
  return filters.map((filter) => ({
    ...filter,
    limit: (filter.limit ?? 1) * 2,
  }));
}
