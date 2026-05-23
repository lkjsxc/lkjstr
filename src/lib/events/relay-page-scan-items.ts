import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type { RelayGroupPageRequest } from './relay-page';
import { afterCursor, beforeCursor } from './repository-shared';
import { mergeFeedEvents, sortFeedEvents } from './relay-page-merge';
import type { FeedEvent } from './types';

export function pageScanItems(
  events: readonly FeedEvent[],
  request: Pick<RelayGroupPageRequest, 'before' | 'after' | 'pageSize'>,
): FeedEvent[] {
  return sortFeedEvents(mergeFeedEvents(events))
    .filter((item) => beforeCursor(item.event, request.before))
    .filter((item) => afterCursor(item.event, request.after))
    .slice(0, request.pageSize);
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
