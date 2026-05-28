import type { NostrFilter } from '../protocol';
import type { RelayRouteGroup } from '../relays/relay-route-types';
import { eventsMatching } from './repository';
import { mergedDisplayBounds } from './feed-display-bounds';
import { coverageCoversRequirements } from './feed-coverage-query';
import { coverageForFeed } from './feed-coverage-store';
import { mergeBounds } from './relay-page-filter';
import { limitedRelayFilterGroups } from './relay-page-limits';
import { mergeFeedEvents } from './relay-page-merge';
import { pageScanItems } from './relay-page-scan-items';
import { semanticFilterKey } from './relay-page-scan-diagnostics';
import { segmentBounds, type RelayPageSegment } from './relay-page-segments';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedEvent } from './types';
import type { SegmentRead } from './relay-page-scan-read';

export async function readCachedSegment(
  request: RelayGroupPageRequest,
  group: RelayRouteGroup,
  segment: RelayPageSegment,
  baseFilters: readonly NostrFilter[],
): Promise<SegmentRead | undefined> {
  const batches = await limitedRelayFilterGroups(
    group.relays,
    baseFilters,
    request.pageSize,
  );
  const bounds = segmentBounds(segment);
  const batchFilters = batches.map((batch) => ({
    relays: batch.relays,
    filters: batch.filters.map((filter) => mergeBounds(filter, bounds)),
  }));
  const requirements = batchFilters.flatMap((batch) =>
    batch.relays.flatMap((relayUrl) =>
      batch.filters.map((filter) => ({
        groupKey: group.key,
        relayUrl,
        filterKey: semanticFilterKey(filter),
        since: filter.since,
        until: filter.until,
      })),
    ),
  );
  const decision = coverageCoversRequirements(
    requirements,
    await coverageForFeed(request.key),
  );
  if (decision.kind !== 'covered') return undefined;
  const filters = batchFilters.flatMap((batch) => batch.filters);
  const cached = await eventsMatching(filters);
  const receivedItems = mergeFeedEvents(cached);
  const items = pageScanItems(receivedItems, {
    ...request,
    displayBounds: mergedDisplayBounds(request, segment),
  });
  return {
    items,
    receivedItems,
    complete: true,
    dense: false,
    hitLimit: false,
    underHalfLimit: underHalf(filters, request.pageSize, items),
    contacted: true,
    source: 'cache',
  };
}

function underHalf(
  filters: readonly NostrFilter[],
  pageSize: number,
  items: readonly FeedEvent[],
): boolean {
  const limit = Math.max(
    1,
    filters.reduce((sum, filter) => sum + (filter.limit ?? pageSize), 0),
  );
  return items.length <= Math.floor(limit / 2);
}
