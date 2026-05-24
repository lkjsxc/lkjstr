import { countRuntime } from '../app/runtime-counters';
import { mergeSafeCursor, nextScanCursor } from './relay-page-scan-cursors';
import type { RelayGroupPageRequest, RelayGroupPageResult } from './relay-page';
import type { FeedCursorPoint, FeedEvent } from './types';
import { mergeFeedEvents, sortFeedEvents } from './relay-page-merge';
import { pageScanItems } from './relay-page-scan-items';
import {
  canSplitRelayPageSegment,
  initialRelayPageSegment,
  nextGrownRelayPageSegment,
  relayPageSegmentCursor,
  relaySegmentMaxSegmentsPerPage,
  splitRelayPageSegment,
  type RelayPageSegment,
} from './relay-page-segments';
import { readSegment, type SegmentRead } from './relay-page-scan-read';

export async function scanRelayFeedGroups(
  request: RelayGroupPageRequest,
): Promise<RelayGroupPageResult> {
  countRuntime('timeline', 'scanReads');
  const direction = request.direction ?? 'older';
  const collected: FeedEvent[] = [];
  let safeCursor: FeedCursorPoint | undefined;
  let segment = initialRelayPageSegment({ ...request, direction });
  const queue: RelayPageSegment[] = [segment];
  let processed = 0;
  while (queue.length > 0 && processed < relaySegmentMaxSegmentsPerPage) {
    segment = queue.shift()!;
    processed += 1;
    const read = await readSegment(request, segment, processed - 1);
    collected.push(...read.receivedItems);
    const items = pageScanItems(collected, request);
    if (!read.contacted) continue;
    if (read.complete && !read.dense) {
      countRuntime('timeline', 'coverageCompleteSegments');
      countRuntime('timeline', 'completedCoverageWindows');
      if (items.length >= request.pageSize)
        return result(request, collected, items, true, read);
      const grown = nextGrownRelayPageSegment(segment, {
        ...request,
        direction,
      });
      if (read.items.length > 0)
        return result(request, collected, items, Boolean(grown), read);
      if (!grown) return result(request, collected, items, false, read);
      countRuntime('timeline', 'grownWindows');
      queue.push(grown);
      continue;
    }
    countUnproven(read);
    if (read.dense && items.length >= request.pageSize) {
      safeCursor = mergeSafeCursor(
        request,
        safeCursor,
        read.safeCursor ?? relayPageSegmentCursor(segment, direction),
      );
      return result(request, collected, items, true, { ...read, safeCursor });
    }
    if (shouldSplit(read, segment)) {
      countRuntime('timeline', 'splitWindows');
      queue.unshift(...splitRelayPageSegment(segment, direction));
      continue;
    }
    countRuntime('timeline', 'unresolvedSegments');
    safeCursor = mergeSafeCursor(
      request,
      safeCursor,
      read.safeCursor ?? relayPageSegmentCursor(segment, direction),
    );
    return result(request, collected, items, true, { ...read, safeCursor });
  }
  const items = pageScanItems(collected, request);
  if (queue.length > 0) safeCursor = relayPageSegmentCursor(segment, direction);
  return result(request, collected, items, Boolean(safeCursor), {
    items,
    receivedItems: mergeFeedEvents(collected),
    complete: !safeCursor,
    dense: false,
    contacted: collected.length > 0,
    safeCursor,
  });
}

function shouldSplit(read: SegmentRead, segment: RelayPageSegment): boolean {
  if (!canSplitRelayPageSegment(segment)) return false;
  if (read.dense) return true;
  return !read.complete && segment.depth === 0;
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
