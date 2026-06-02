import { pageIntentBounds } from '../relays/orchestration/page-reads';
import {
  relaySegmentMaxSegmentsPerPage,
  initialRelayPageSegmentWithSpan,
} from './relay-page-segments';
import { nextScanCursor } from './relay-page-scan-cursors';
import { warmInitialSpan } from './relay-page-scan-hints';
import { pageScanItems, scanCandidates } from './relay-page-scan-items';
import {
  nextCoveredSegment,
  readCacheOnlySegment,
} from './feed-page-cache-segment';
import type { FeedEvent } from './types';
import type {
  CachedFeedPage,
  CacheFirstFeedDecision,
  CoverageProof,
  FeedPageIntent,
  FeedPagePlan,
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
    if (items.length >= request.pageSize)
      return completeDecision(request, items, true);
    const next = nextCoveredSegment(request, segment, segmentDecision.read);
    if (!next) return completeDecision(request, items, false);
    queue.push(next);
  }
  return completeDecision(
    request,
    pageScanItems(collected, request),
    queue.length > 0,
  );
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

function completeDecision(
  request: FeedPagePlan,
  items: FeedEvent[],
  hasMore: boolean,
): Extract<CacheFirstFeedDecision, { readonly kind: 'complete-cache' }> {
  return {
    kind: 'complete-cache',
    page: page(request, items, hasMore, 'complete'),
  };
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
