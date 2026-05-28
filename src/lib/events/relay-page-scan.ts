import { countRuntime } from '../app/runtime-counters';
import { mergeSafeCursor, nextScanCursor } from './relay-page-scan-cursors';
import type { RelayGroupPageRequest, RelayGroupPageResult } from './relay-page';
import type { FeedCursorPoint, FeedEvent } from './types';
import { mergeFeedEvents, sortFeedEvents } from './relay-page-merge';
import { pageScanItems, scanCandidates } from './relay-page-scan-items';
import {
  initialRelayPageSegment,
  relayPageSegmentCursor,
  relaySegmentMaxSegmentsPerPage,
  type RelayPageSegment,
} from './relay-page-segments';
import { readSegment, type SegmentRead } from './relay-page-scan-read';
import {
  classifyWindowFeedback,
  nextAdaptiveRelayWindow,
} from './relay-window-policy';

export async function scanRelayFeedGroups(
  request: RelayGroupPageRequest,
): Promise<RelayGroupPageResult> {
  countRuntime('timeline', 'scanReads');
  const direction = request.direction ?? 'older';
  let collected: FeedEvent[] = [];
  let safeCursor: FeedCursorPoint | undefined;
  let segment = initialRelayPageSegment({ ...request, direction });
  const queue: RelayPageSegment[] = [segment];
  let processed = 0;
  while (queue.length > 0 && processed < relaySegmentMaxSegmentsPerPage) {
    segment = queue.shift()!;
    processed += 1;
    const read = await readSegment(request, segment, processed - 1);
    collected.push(...read.receivedItems);
    collected = scanCandidates(collected, request.pageSize);
    const items = pageScanItems(collected, request);
    if (!read.contacted) continue;
    const feedback = classifyWindowFeedback(read);
    if (read.complete && !read.hitLimit) {
      countRuntime('timeline', 'coverageCompleteSegments');
      countRuntime('timeline', 'completedCoverageWindows');
      if (items.length >= request.pageSize)
        return result(request, collected, items, true, read);
      const next = nextAdaptiveRelayWindow(
        segment,
        { ...request, direction },
        feedback,
      );
      if (next.kind !== 'advance')
        return result(request, collected, items, false, read);
      if (feedback === 'under-half') countRuntime('timeline', 'grownWindows');
      queue.push(next.segment);
      continue;
    }
    countUnproven(read);
    const next = nextAdaptiveRelayWindow(
      segment,
      { ...request, direction },
      feedback,
    );
    if (next.kind === 'split') {
      countRuntime('timeline', 'splitWindows');
      queue.unshift(...next.segments);
      continue;
    }
    countRuntime('timeline', 'unresolvedSegments');
    safeCursor = mergeSafeCursor(
      request,
      safeCursor,
      read.safeCursor ?? relayPageSegmentCursor(segment, direction),
    );
    if (items.length === 0 && queue.length > 0) continue;
    return result(request, collected, items, true, { ...read, safeCursor });
  }
  const items = pageScanItems(collected, request);
  if (queue.length > 0) safeCursor = relayPageSegmentCursor(segment, direction);
  return result(request, collected, items, Boolean(safeCursor), {
    items,
    receivedItems: mergeFeedEvents(collected),
    complete: !safeCursor,
    dense: false,
    hitLimit: false,
    underHalfLimit: true,
    contacted: collected.length > 0,
    safeCursor,
  });
}

function countUnproven(read: SegmentRead): void {
  if (read.dense) {
    countRuntime('timeline', 'denseSegments');
    countRuntime('timeline', 'denseWindows');
  }
  if (!read.complete) {
    countRuntime('timeline', 'coverageIncompleteSegments');
    countRuntime('timeline', 'incompleteWindows');
  }
}

function result(
  request: RelayGroupPageRequest,
  received: readonly FeedEvent[],
  items: FeedEvent[],
  hasMorePossible: boolean,
  segment?: SegmentRead,
): RelayGroupPageResult {
  return {
    items,
    receivedItems: sortFeedEvents(mergeFeedEvents(received)),
    hasMorePossible,
    nextCursor: nextScanCursor(request, items, segment?.safeCursor),
    incomplete: Boolean(segment && !segment.complete),
    dense: Boolean(segment?.dense),
  };
}
