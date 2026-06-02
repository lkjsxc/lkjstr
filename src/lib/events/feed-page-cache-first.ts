import { mapAsyncBounded } from '../fp/async';
import { pageIntentBounds } from '../relays/orchestration/page-reads';
import { mergedDisplayBounds } from './feed-display-bounds';
import { mergeFeedEvents } from './relay-page-merge';
import { positiveFilters } from './relay-page-filter';
import {
  relaySegmentMaxSegmentsPerPage,
  initialRelayPageSegmentWithSpan,
  segmentBounds,
  type RelayPageSegment,
} from './relay-page-segments';
import { nextScanCursor } from './relay-page-scan-cursors';
import { warmInitialSpan } from './relay-page-scan-hints';
import { pageScanItems, scanCandidates } from './relay-page-scan-items';
import { buildSegmentCachePlan } from './relay-page-cache-plan';
import type { SegmentRead } from './relay-page-scan-types';
import {
  classifyWindowFeedback,
  nextAdaptiveRelayWindow,
} from './relay-window-policy';
import type { FeedEvent } from './types';
import type {
  CacheFirstFeedDecision,
  CoverageProof,
  FeedPageIntent,
  FeedPagePlan,
  PartialSegmentDecision,
  SegmentDecision,
} from './feed-page-cache-types';

export async function readCacheFirstFeedPage(
  intent: FeedPageIntent,
): Promise<CacheFirstFeedDecision> {
  const request = pageRequest(intent);
  if (!request) return { kind: 'miss', reason: 'missing page filters' };
  const direction = request.direction ?? 'older';
  const initialSpan = await warmInitialSpan(request, direction);
  const queue = [initialRelayPageSegmentWithSpan(request, initialSpan)];
  const maxSegments = intent.maxSegments ?? relaySegmentMaxSegmentsPerPage;
  let collected: FeedEvent[] = [];
  let processed = 0;
  while (queue.length > 0 && processed < maxSegments) {
    const segment = queue.shift()!;
    processed += 1;
    const segmentDecision = await readCacheOnlySegment(request, segment);
    collected = scanCandidates(
      [...collected, ...segmentDecision.read.receivedItems],
      request.pageSize,
    );
    const items = pageScanItems(collected, request);
    if (segmentDecision.kind !== 'complete')
      return incompleteDecision(request, items, segmentDecision);
    if (items.length >= request.pageSize) return completeDecision(request, items, true);
    const next = nextCoveredSegment(request, segment, segmentDecision.read);
    if (!next) return completeDecision(request, items, false);
    queue.push(next);
  }
  return completeDecision(request, pageScanItems(collected, request), queue.length > 0);
}

function pageRequest(intent: FeedPageIntent): FeedPagePlan | undefined {
  const filters = intent.plan.intent.filters;
  if (!filters) return undefined;
  return {
    key: intent.plan.key,
    groups: intent.plan.groups,
    filters,
    direction: intent.plan.intent.direction,
    ...pageIntentBounds(intent.plan.intent),
    pageSize: intent.plan.intent.pageSize,
    subscriptions: intent.subscriptions,
    purpose: intent.plan.intent.purpose ?? 'feed',
  };
}

async function readCacheOnlySegment(
  request: FeedPagePlan,
  segment: RelayPageSegment,
): Promise<SegmentDecision> {
  const reads = await mapAsyncBounded(request.groups, 4, async (group) => {
    const bounds = segmentBounds(segment);
    const filters = positiveFilters(request.filters(group, bounds), request.pageSize);
    const plan = await buildSegmentCachePlan(request, group, segment, filters);
    if (plan.kind === 'covered') return { kind: 'complete' as const, read: plan.read };
    if (plan.kind === 'partial')
      return { kind: 'partial' as const, read: plan.cached, uncovered: plan.uncovered, reason: plan.reason };
    return { kind: 'miss' as const, read: emptyRead(), uncovered: plan.uncovered, reason: plan.reason };
  });
  return combineSegmentDecisions(request, segment, reads);
}

function combineSegmentDecisions(
  request: FeedPagePlan,
  segment: RelayPageSegment,
  reads: readonly PartialSegmentDecision[],
): SegmentDecision {
  const read = combineReads(request, segment, reads.map((item) => item.read));
  const incomplete = reads.find((item) => item.kind !== 'complete');
  const kind = incomplete ? (read.receivedItems.length > 0 ? 'partial' : 'miss') : 'complete';
  return {
    kind,
    read,
    uncovered: reads.flatMap((item) => item.uncovered ?? []),
    reason: incomplete?.reason ?? 'complete coverage',
  };
}

function combineReads(
  request: FeedPagePlan,
  segment: RelayPageSegment,
  reads: readonly SegmentRead[],
): SegmentRead {
  const receivedItems = mergeFeedEvents(reads.flatMap((read) => read.receivedItems));
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

function nextCoveredSegment(
  request: FeedPagePlan,
  segment: RelayPageSegment,
  read: SegmentRead,
): RelayPageSegment | undefined {
  const feedback = classifyWindowFeedback(read);
  const next = feedback ? nextAdaptiveRelayWindow(segment, request, feedback) : undefined;
  return next?.kind === 'advance' ? next.segment : undefined;
}

function completeDecision(
  request: FeedPagePlan,
  items: FeedEvent[],
  hasMore: boolean,
): Extract<CacheFirstFeedDecision, { readonly kind: 'complete-cache' }> {
  return { kind: 'complete-cache', page: page(request, items, hasMore, 'complete') };
}

function incompleteDecision(
  request: FeedPagePlan,
  items: FeedEvent[],
  decision: SegmentDecision,
): CacheFirstFeedDecision {
  if (items.length === 0) return { kind: 'miss', reason: decision.reason };
  return {
    kind: 'partial-cache',
    page: page(request, items, true, proofStatus(decision), decision.reason),
    uncovered: decision.uncovered,
    reason: decision.reason,
  };
}

function proofStatus(decision: SegmentDecision): 'partial' | 'missing' {
  return decision.kind === 'miss' ? 'missing' : 'partial';
}

function page(
  request: FeedPagePlan,
  items: FeedEvent[],
  hasMore: boolean,
  proofStatus: CoverageProof['status'],
  diagnosticReason?: string,
): CachedFeedPage {
  const newer = request.direction === 'newer';
  return {
    items,
    hasOlder: newer ? false : hasMore,
    hasNewer: newer ? hasMore : false,
    nextCursor: nextScanCursor(request, items, undefined),
    proofStatus,
    diagnosticReason,
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
