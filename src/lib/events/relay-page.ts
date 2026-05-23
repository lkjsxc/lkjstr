import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import type { RelayRouteGroup } from '../relays/relay-route-types';
import type { FeedCursorPoint, FeedEvent } from './types';
import { afterCursor, beforeCursor } from './repository-shared';
import { limitedRelayFilterGroups } from './relay-page-limits';
import {
  mergeFeedEvents,
  mergePoolEvents,
  sortFeedEvents,
} from './relay-page-merge';

export type RelayPageRequest = {
  readonly key: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly subscriptions: RelaySubscriptionManager;
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
  readonly pageSize: number;
  readonly purpose?:
    | 'feed'
    | 'metadata'
    | 'event-lookup'
    | 'route-discovery'
    | 'search';
};

export type RelayGroupPageRequest = Omit<
  RelayPageRequest,
  'relays' | 'filters'
> & {
  readonly groups: readonly RelayRouteGroup[];
  readonly filters: (
    group: RelayRouteGroup,
    bounds: Pick<NostrFilter, 'since' | 'until'>,
  ) => readonly NostrFilter[];
  readonly direction?: 'older' | 'newer' | 'initial';
};

export async function readRelayPage(
  request: RelayPageRequest,
): Promise<PoolEvent[]> {
  if (request.relays.length === 0) return [];
  const filters = positiveFilters(request.filters, request.pageSize);
  const groups = await limitedRelayFilterGroups(
    request.relays,
    filters,
    request.pageSize,
  );
  const pages = await Promise.all(
    groups.map((group) =>
      request.subscriptions.readPage({
        key: request.key,
        relays: group.relays,
        filters: group.filters,
        purpose: request.purpose,
      }),
    ),
  );
  return pages.flat();
}

export async function readRelayFeedPage(
  request: RelayPageRequest,
): Promise<FeedEvent[]> {
  if (request.relays.length === 0) return [];
  const events = await readRelayPage({
    ...request,
    filters: request.filters.map((filter) =>
      boundaryFilter(filter, request.before, request.after),
    ),
  });
  return sortFeedEvents(mergePoolEvents(events))
    .filter((item) => beforeCursor(item.event, request.before))
    .filter((item) => afterCursor(item.event, request.after))
    .slice(0, request.pageSize);
}

export async function readRelayFeedGroups(
  request: RelayGroupPageRequest,
): Promise<{ items: FeedEvent[]; hasMorePossible: boolean }> {
  const bounds = intervalBounds(request);
  const pages: FeedEvent[][] = [];
  for (const [index, group] of request.groups.entries()) {
    if (group.relays.length === 0) continue;
    const filters = positiveFilters(
      request.filters(group, bounds),
      request.pageSize,
    );
    if (filters.length === 0) continue;
    pages.push(
      await readRelayFeedPage({
        ...request,
        key: `${request.key}:${index}`,
        relays: group.relays,
        filters,
        pageSize: request.pageSize,
      }),
    );
  }
  const items = sortFeedEvents(mergeFeedEvents(pages.flat()))
    .filter((item) => beforeCursor(item.event, request.before))
    .filter((item) => afterCursor(item.event, request.after))
    .slice(0, request.pageSize);
  return {
    items,
    hasMorePossible: pages.some((page) => page.length >= request.pageSize),
  };
}

export function boundaryUntil(
  cursor: FeedCursorPoint | undefined,
): number | undefined {
  return cursor ? cursor.createdAt + 1 : undefined;
}

export function boundarySince(
  cursor: FeedCursorPoint | undefined,
): number | undefined {
  if (!cursor) return undefined;
  return Math.max(0, cursor.createdAt - 1);
}

function boundaryFilter(
  filter: NostrFilter,
  before?: FeedCursorPoint,
  after?: FeedCursorPoint,
): NostrFilter {
  const until = min(filter.until, boundaryUntil(before));
  const since = max(filter.since, boundarySince(after));
  return { ...filter, until, since };
}

function intervalBounds(
  request: Pick<RelayGroupPageRequest, 'before' | 'after' | 'direction'>,
): Pick<NostrFilter, 'since' | 'until'> {
  if (request.direction === 'initial') return {};
  const cursor = request.before ?? request.after;
  if (!cursor) return {};
  const until = request.before
    ? boundaryUntil(request.before)
    : cursor.createdAt + intervalWindows.at(-1)!;
  const since = request.after
    ? boundarySince(request.after)
    : Math.max(0, cursor.createdAt - nextInterval(cursor.createdAt));
  return { since, until };
}

function nextInterval(createdAt: number): number {
  const age = Math.max(0, Math.floor(Date.now() / 1000) - createdAt);
  return (
    intervalWindows.find((window) => age < window) ?? intervalWindows.at(-1)!
  );
}

function positiveFilters(
  filters: readonly NostrFilter[],
  pageSize: number,
): NostrFilter[] {
  return filters
    .map((filter) => ({
      ...filter,
      limit: Math.max(1, filter.limit ?? pageSize),
    }))
    .filter((filter) => filter.limit > 0);
}

const intervalWindows = [6, 24, 72, 168, 720].map((hours) => hours * 60 * 60);

function min(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.min(left, right);
}

function max(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}
