import { mapAsyncBounded } from '../fp/async';
import { mergedDisplayBounds } from './feed-display-bounds';
import { positiveFilters } from './relay-page-filter';
import { buildSegmentCachePlan } from './relay-page-cache-plan';
import { mergeFeedEvents } from './relay-page-merge';
import { pageScanItems } from './relay-page-scan-items';
import type { SegmentRead } from './relay-page-scan-types';
import { segmentBounds, type RelayPageSegment } from './relay-page-segments';
import {
  classifyWindowFeedback,
  nextAdaptiveRelayWindow,
} from './relay-window-policy';
import type {
  FeedPagePlan,
  PartialSegmentDecision,
  SegmentDecision,
} from './feed-page-cache-types';

export async function readCacheOnlySegment(
  request: FeedPagePlan,
  segment: RelayPageSegment,
): Promise<SegmentDecision> {
  const reads = await mapAsyncBounded(request.groups, 4, async (group) => {
    const bounds = segmentBounds(segment);
    const filters = positiveFilters(
      request.filters(group, bounds),
      request.pageSize,
    );
    const plan = await buildSegmentCachePlan(request, group, segment, filters);
    if (plan.kind === 'covered')
      return { kind: 'complete' as const, read: plan.read };
    if (plan.kind === 'partial')
      return {
        kind: 'partial' as const,
        read: plan.cached,
        uncovered: plan.uncovered,
        reason: plan.reason,
      };
    return {
      kind: 'miss' as const,
      read: emptyRead(),
      uncovered: plan.uncovered,
      reason: plan.reason,
    };
  });
  return combineSegmentDecisions(request, segment, reads);
}

export function nextCoveredSegment(
  request: FeedPagePlan,
  segment: RelayPageSegment,
  read: SegmentRead,
): RelayPageSegment | undefined {
  const feedback = classifyWindowFeedback(read);
  const next = feedback
    ? nextAdaptiveRelayWindow(
        segment,
        { ...request, direction: request.direction ?? 'older' },
        feedback,
      )
    : undefined;
  return next?.kind === 'advance' ? next.segment : undefined;
}

function combineSegmentDecisions(
  request: FeedPagePlan,
  segment: RelayPageSegment,
  reads: readonly PartialSegmentDecision[],
): SegmentDecision {
  const read = combineReads(
    request,
    segment,
    reads.map((item) => item.read),
  );
  const incomplete = reads.find((item) => item.kind !== 'complete');
  const kind = incomplete
    ? read.receivedItems.length > 0
      ? 'partial'
      : 'miss'
    : 'complete';
  return {
    kind,
    read,
    uncovered: reads.flatMap((item) =>
      'uncovered' in item ? item.uncovered : [],
    ),
    reason: incomplete?.reason ?? 'complete coverage',
  };
}

function combineReads(
  request: FeedPagePlan,
  segment: RelayPageSegment,
  reads: readonly SegmentRead[],
): SegmentRead {
  const receivedItems = mergeFeedEvents(
    reads.flatMap((read) => read.receivedItems),
  );
  return {
    items: pageScanItems(receivedItems, {
      ...request,
      displayBounds: mergedDisplayBounds(request, segment),
    }),
    receivedItems,
    complete: reads.every((read) => read.complete),
    dense: reads.some((read) => read.dense),
    hitLimit: reads.some((read) => read.hitLimit),
    underHalfLimit: reads.every((read) => read.underHalfLimit),
    contacted: reads.some((read) => read.contacted),
    source: 'cache',
  };
}

function emptyRead(): SegmentRead {
  return {
    items: [],
    receivedItems: [],
    complete: false,
    dense: false,
    hitLimit: false,
    underHalfLimit: true,
    contacted: false,
  };
}
