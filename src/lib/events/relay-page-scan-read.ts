import type { PoolEvent } from '../relays/relay-pool';
import { mapAsyncBounded } from '../fp/async';
import { mergeSafeCursor, scanCursor } from './relay-page-scan-cursors';
import { mergeBounds, positiveFilters } from './relay-page-filter';
import { mergedDisplayBounds } from './feed-display-bounds';
import {
  limitedRelayFilterGroups,
  relayReadEventCap,
} from './relay-page-limits';
import { mergeFeedEvents, mergePoolEvents } from './relay-page-merge';
import { needsCursorSlack, pageScanItems } from './relay-page-scan-items';
import { retainedRawCandidates } from './relay-page-scan-raw';
import { readScanBatch } from './relay-page-scan-batch';
import { readCachedSegment } from './relay-page-scan-cache';
import {
  recordBatchCoverage,
  recordUnresolved,
} from './relay-page-scan-record';
import {
  canSplitRelayPageSegment,
  segmentBounds,
  type RelayPageSegment,
} from './relay-page-segments';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedCursorPoint, FeedEvent } from './types';

export type SegmentRead = {
  readonly items: FeedEvent[];
  readonly receivedItems: FeedEvent[];
  readonly complete: boolean;
  readonly dense: boolean;
  readonly hitLimit: boolean;
  readonly underHalfLimit: boolean;
  readonly contacted: boolean;
  readonly source?: 'relay' | 'cache';
  readonly safeCursor?: FeedCursorPoint;
};

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

async function readGroup(
  request: RelayGroupPageRequest,
  segment: RelayPageSegment,
  segmentIndex: number,
  groupIndex: number,
): Promise<SegmentRead> {
  const group = request.groups[groupIndex]!;
  let raw: PoolEvent[] = [];
  let complete = true;
  let hitLimit = false;
  let underHalfLimit = true;
  let contacted = false;
  const bounds = segmentBounds(segment);
  const baseFilters = positiveFilters(
    request.filters(group, bounds),
    request.pageSize,
  );
  const cached = await readCachedSegment(request, group, segment, baseFilters);
  if (cached) return cached;
  for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
    const batches = await limitedRelayFilterGroups(
      group.relays,
      baseFilters,
      request.pageSize,
    );
    raw.length = 0;
    complete = true;
    hitLimit = false;
    underHalfLimit = true;
    contacted = false;
    const reads = await mapAsyncBounded(
      batches,
      4,
      async (batch, batchIndex) => {
        const filters = batch.filters.map((item) => mergeBounds(item, bounds));
        const read = await readScanBatch(request, group.key, {
          segmentIndex,
          groupIndex,
          attemptIndex,
          batchIndex,
          relays: batch.relays,
          filters,
        });
        await recordBatchCoverage(
          request,
          group.key,
          batch.relays,
          filters,
          read,
          segment,
          attemptIndex,
        );
        return { read, filters, relays: batch.relays };
      },
    );
    for (const { read, filters, relays } of reads) {
      raw.push(...read.events);
      raw = retainedRawCandidates(
        raw,
        request.pageSize,
        relayReadEventCap(filters, relays.length, request.pageSize),
      );
      complete = complete && read.complete;
      hitLimit = hitLimit || read.density.hitLimit;
      underHalfLimit = underHalfLimit && read.density.underHalfLimit;
      contacted = true;
    }
    const items = pageScanItems(mergePoolEvents(raw), {
      ...request,
      displayBounds: mergedDisplayBounds(request, segment),
    });
    if (
      !hitLimit &&
      needsCursorSlack(raw, items.length, request) &&
      attemptIndex === 0
    )
      continue;
    break;
  }
  const items = pageScanItems(mergePoolEvents(raw), {
    ...request,
    displayBounds: mergedDisplayBounds(request, segment),
  });
  const unresolved = !complete || hitLimit;
  if (unresolved && (!complete || !canSplitRelayPageSegment(segment)))
    await recordUnresolved(
      request,
      group.key,
      group.relays,
      baseFilters,
      segment,
      hitLimit,
      raw,
    );
  return {
    items,
    receivedItems: mergePoolEvents(raw),
    complete,
    dense: hitLimit,
    hitLimit,
    underHalfLimit,
    contacted,
    safeCursor: unresolved ? scanCursor(request, items) : undefined,
  };
}

function emptySegmentRead(): SegmentRead {
  return {
    items: [],
    receivedItems: [],
    complete: true,
    dense: false,
    hitLimit: false,
    underHalfLimit: true,
    contacted: false,
  };
}
