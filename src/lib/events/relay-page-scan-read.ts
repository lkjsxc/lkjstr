import { mapAsyncBounded } from '../fp/async';
import { mergeSafeCursor } from './relay-page-scan-cursors';
import { mergedDisplayBounds } from './feed-display-bounds';
import { mergeFeedEvents } from './relay-page-merge';
import { pageScanItems } from './relay-page-scan-items';
import { type RelayPageSegment } from './relay-page-segments';
import { readGroup } from './relay-page-scan-group';
import { emptySegmentRead, type SegmentRead } from './relay-page-scan-types';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedCursorPoint, FeedEvent } from './types';

export type { SegmentRead } from './relay-page-scan-types';

export async function readSegment(
  request: RelayGroupPageRequest,
  bounds: RelayPageSegment,
  segmentIndex: number,
): Promise<SegmentRead> {
  const received: FeedEvent[] = [];
  let complete = true;
  let dense = false;
  let hitLimit = false;
  let underHalfLimit = true;
  let contacted = false;
  let safeCursor: FeedCursorPoint | undefined;
  const reads = await mapAsyncBounded(
    request.groups,
    4,
    async (group, groupIndex) => {
      if (group.relays.length === 0 || request.signal?.aborted)
        return emptySegmentRead();
      return readGroup(request, bounds, segmentIndex, groupIndex);
    },
  );
  for (const read of reads) {
    received.push(...read.receivedItems);
    complete = complete && read.complete;
    dense = dense || read.dense;
    hitLimit = hitLimit || read.hitLimit;
    underHalfLimit = underHalfLimit && read.underHalfLimit;
    contacted = contacted || read.contacted;
    safeCursor = mergeSafeCursor(request, safeCursor, read.safeCursor);
  }
  return {
    items: pageScanItems(received, {
      ...request,
      displayBounds: mergedDisplayBounds(request, bounds),
    }),
    receivedItems: mergeFeedEvents(received),
    complete,
    dense,
    hitLimit,
    underHalfLimit,
    contacted,
    safeCursor,
  };
}
