import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type { OnProgressiveReadSnapshot } from '../relays/progressive-read-types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';

export type RelayReadSubscriptions = Pick<
  SubscriptionOrchestrator,
  'readPage' | 'readPageDetailed'
>;
import type { RelayRouteGroup } from '../relays/relay-route-types';
import type { FeedCursorPoint, FeedEvent } from './types';
import { limitedRelayFilterGroups } from './relay-page-limits';
import { mergePoolEvents, sortFeedEvents } from './relay-page-merge';
import { scanRelayFeedGroups } from './relay-page-scan';
import {
  boundaryFilter,
  boundarySince,
  boundaryUntil,
  positiveFilters,
} from './relay-page-filter';
import { eventInDisplayBounds } from './feed-display-bounds';

export type RelayPageRequest = {
  readonly key: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly subscriptions: RelayReadSubscriptions;
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
  readonly since?: number;
  readonly until?: number;
  readonly pageSize: number;
  readonly signal?: AbortSignal;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
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
      request.subscriptions.readPage(
        {
          key: request.key,
          relays: group.relays,
          filters: group.filters,
          purpose: request.purpose,
        },
        {
          maxEvents: group.maxEvents,
          signal: request.signal,
          onSnapshot: request.onSnapshot,
        },
      ),
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
    signal: request.signal,
    onSnapshot: request.onSnapshot,
  });
  return sortFeedEvents(mergePoolEvents(events))
    .filter((item) =>
      eventInDisplayBounds(item.event, {
        before: request.before,
        after: request.after,
        since: request.since,
        until: request.until,
      }),
    )
    .slice(0, request.pageSize);
}

export async function readRelayFeedGroups(
  request: RelayGroupPageRequest,
): Promise<RelayGroupPageResult> {
  return scanRelayFeedGroups(request);
}

export { boundarySince, boundaryUntil };
