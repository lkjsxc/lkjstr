import type { NostrFilter } from '../protocol';
import type { RelayRouteGroup } from '../relays/relay-route-types';
import { countRuntime } from '../app/runtime-counters';
import { coverageCoversRequirements } from './feed-coverage-query';
import { coverageForFeed } from './feed-coverage-store';
import { mergedDisplayBounds } from './feed-display-bounds';
import { eventsMatching } from './repository';
import { mergeBounds } from './relay-page-filter';
import {
  limitedRelayFilterGroups,
  type LimitedRelayFilters,
} from './relay-page-limits';
import { mergeFeedEvents } from './relay-page-merge';
import { semanticFilterKey } from './relay-page-scan-diagnostics';
import { pageScanItems } from './relay-page-scan-items';
import { segmentBounds, type RelayPageSegment } from './relay-page-segments';
import type { SegmentRead } from './relay-page-scan-types';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedEvent } from './types';

export type RelayFilterBatch = LimitedRelayFilters;

export type SegmentCachePlan =
  | {
      readonly kind: 'covered';
      readonly read: SegmentRead;
      readonly skippedRelays: readonly string[];
    }
  | {
      readonly kind: 'partial';
      readonly cached: SegmentRead;
      readonly uncovered: readonly RelayFilterBatch[];
      readonly skippedRelays: readonly string[];
      readonly reason: string;
    }
  | {
      readonly kind: 'miss';
      readonly uncovered: readonly RelayFilterBatch[];
      readonly reason: string;
    };

type RequirementPlan = {
  readonly relayUrl: string;
  readonly filter: NostrFilter;
  readonly maxEvents: number;
  readonly covered: boolean;
};

export async function buildSegmentCachePlan(
  request: RelayGroupPageRequest,
  group: RelayRouteGroup,
  segment: RelayPageSegment,
  baseFilters: readonly NostrFilter[],
): Promise<SegmentCachePlan> {
  const batches = await limitedRelayFilterGroups(
    group.relays,
    baseFilters,
    request.pageSize,
  );
  const batchFilters = boundedBatchFilters(batches, segment);
  const coverage = await coverageForFeed(request.key);
  const plans = batchFilters.flatMap((batch) =>
    batch.relays.flatMap((relayUrl) =>
      batch.filters.map((filter) => ({
        relayUrl,
        filter,
        maxEvents: batch.maxEvents,
        covered:
          coverageCoversRequirements(
            [
              {
                groupKey: group.key,
                relayUrl,
                filterKey: semanticFilterKey(filter),
                since: filter.since,
                until: filter.until,
              },
            ],
            coverage,
          ).kind === 'covered',
      })),
    ),
  );
  const covered = plans.filter((plan) => plan.covered);
  const uncovered = uncoveredBatches(plans);
  if (covered.length === 0) {
    countRuntime('timeline', 'cacheCoverageMisses');
    return { kind: 'miss', uncovered, reason: 'no complete coverage' };
  }
  const cached = await cachedRead(request, segment, covered);
  const skippedRelays = [
    ...new Set(covered.map((plan) => plan.relayUrl)),
  ].sort();
  for (let index = 0; index < skippedRelays.length; index += 1)
    countRuntime('timeline', 'cacheSkippedRelayReads');
  if (uncovered.length === 0) {
    countRuntime('timeline', 'cacheCoverageHits');
    return { kind: 'covered', read: cached, skippedRelays };
  }
  countRuntime('timeline', 'cacheCoveragePartialHits');
  return {
    kind: 'partial',
    cached,
    uncovered,
    skippedRelays,
    reason: 'partial complete coverage',
  };
}

function boundedBatchFilters(
  batches: readonly LimitedRelayFilters[],
  segment: RelayPageSegment,
): RelayFilterBatch[] {
  const bounds = segmentBounds(segment);
  return batches.map((batch) => ({
    relays: batch.relays,
    filters: batch.filters.map((filter) => mergeBounds(filter, bounds)),
    maxEvents: batch.maxEvents,
  }));
}

function uncoveredBatches(
  plans: readonly RequirementPlan[],
): RelayFilterBatch[] {
  const groups = new Map<string, RelayFilterBatch>();
  for (const plan of plans.filter((item) => !item.covered)) {
    const key = JSON.stringify(plan.filter);
    const current = groups.get(key);
    groups.set(key, {
      relays: [...(current?.relays ?? []), plan.relayUrl],
      filters: current?.filters ?? [plan.filter],
      maxEvents: Math.max(current?.maxEvents ?? 0, plan.maxEvents),
    });
  }
  return [...groups.values()];
}

async function cachedRead(
  request: RelayGroupPageRequest,
  segment: RelayPageSegment,
  covered: readonly RequirementPlan[],
): Promise<SegmentRead> {
  const relays = new Set(covered.map((plan) => plan.relayUrl));
  const filters = uniqueFilters(covered.map((plan) => plan.filter));
  const cached = await eventsMatching(filters, {
    limit: localMatchLimit(request.pageSize, filters.length),
  });
  const receivedItems = mergeFeedEvents(
    cached.filter((item) => fromRelays(item, relays)),
  );
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

function uniqueFilters(filters: readonly NostrFilter[]): NostrFilter[] {
  return [
    ...new Map(
      filters.map((filter) => [JSON.stringify(filter), filter]),
    ).values(),
  ];
}

function fromRelays(item: FeedEvent, relays: ReadonlySet<string>): boolean {
  return item.relays.some((relay) => relay === 'cache' || relays.has(relay));
}

function localMatchLimit(pageSize: number, filterCount: number): number {
  return Math.min(1000, Math.max(pageSize * 4, pageSize + filterCount * 50));
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
