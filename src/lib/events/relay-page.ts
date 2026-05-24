import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import type { RelayRouteGroup } from '../relays/relay-route-types';
import type { FeedCursorPoint, FeedEvent } from './types';
import { afterCursor, beforeCursor } from './repository-shared';
import { limitedRelayFilterGroups } from './relay-page-limits';
import { mergePoolEvents, sortFeedEvents } from './relay-page-merge';
import { scanRelayFeedGroups } from './relay-page-scan';
import {
  boundaryFilter,
  boundarySince,
  boundaryUntil,
  positiveFilters,
} from './relay-page-filter';

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

export type RelayGroupPageResult = {
  readonly items: FeedEvent[];
  readonly receivedItems?: FeedEvent[];
  readonly hasMorePossible: boolean;
  readonly nextCursor?: FeedCursorPoint;
  readonly incomplete: boolean;
  readonly dense: boolean;
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
): Promise<RelayGroupPageResult> {
  return scanRelayFeedGroups(request);
}

export { boundarySince, boundaryUntil };
