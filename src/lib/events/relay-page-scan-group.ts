import type { PoolEvent } from '../relays/relay-pool';
import { mapAsyncBounded } from '../fp/async';
import { scanCursor } from './relay-page-scan-cursors';
import { mergeBounds, positiveFilters } from './relay-page-filter';
import { mergedDisplayBounds } from './feed-display-bounds';
import type { LimitedRelayFilters } from './relay-page-limits';
import { mergeFeedEvents, mergePoolEvents } from './relay-page-merge';
import { needsCursorSlack, pageScanItems } from './relay-page-scan-items';
import { retainedRawCandidates } from './relay-page-scan-raw';
import { readScanBatch } from './relay-page-scan-batch';
import { buildSegmentCachePlan } from './relay-page-cache-plan';
import {
  recordBatchCoverage,
  recordUnresolved,
} from './relay-page-scan-record';
import {
  canSplitRelayPageSegment,
  segmentBounds,
  type RelayPageSegment,
} from './relay-page-segments';
import { emptySegmentRead, type SegmentRead } from './relay-page-scan-types';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedEvent } from './types';

export async function readGroup(
  request: RelayGroupPageRequest,
  segment: RelayPageSegment,
  segmentIndex: number,
  groupIndex: number,
): Promise<SegmentRead> {
  const group = request.groups[groupIndex]!;
  if (group.relays.length === 0 || request.signal?.aborted)
    return emptySegmentRead();
  const bounds = segmentBounds(segment);
  const baseFilters = positiveFilters(
    request.filters(group, bounds),
    request.pageSize,
  );
  const plan = await buildSegmentCachePlan(
    request,
    group,
    segment,
    baseFilters,
  );
  if (plan.kind === 'covered') return plan.read;
  const batches = plan.uncovered;
  const cachedItems = plan.kind === 'partial' ? plan.cached.receivedItems : [];
  let raw: PoolEvent[] = [];
  let complete = true;
  let hitLimit = false;
  let underHalfLimit =
    plan.kind === 'partial' ? plan.cached.underHalfLimit : true;
  let contacted = false;
  for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
    raw = [];
    complete = true;
    hitLimit = false;
    underHalfLimit =
      plan.kind === 'partial' ? plan.cached.underHalfLimit : true;
    contacted = false;
    const reads = await readBatches(
      request,
      segment,
      segmentIndex,
      groupIndex,
      group.key,
      batches,
      attemptIndex,
    );
    for (const { read, maxEvents } of reads) {
      raw.push(...read.events);
      raw = retainedRawCandidates(raw, request.pageSize, maxEvents);
      complete = complete && read.complete;
      hitLimit = hitLimit || read.density.hitLimit;
      underHalfLimit = underHalfLimit && read.density.underHalfLimit;
      contacted = true;
    }
    const items = readItems(request, segment, cachedItems, raw);
    if (
      !hitLimit &&
      needsCursorSlack(raw, items.length, request) &&
      attemptIndex === 0
    )
      continue;
    break;
  }
  const items = readItems(request, segment, cachedItems, raw);
  const unresolved = !complete || hitLimit;
  if (unresolved && (!complete || !canSplitRelayPageSegment(segment)))
    void Promise.all(
      batches.map((batch) =>
        recordUnresolved(
          request,
          group.key,
          batch.relays,
          batch.filters,
          segment,
          hitLimit,
          raw,
        ),
      ),
    );
  const receivedItems = mergeFeedEvents([
    ...cachedItems,
    ...mergePoolEvents(raw),
  ]);
  return {
    items,
    receivedItems,
    complete,
    dense: hitLimit,
    hitLimit,
    underHalfLimit,
    contacted,
    safeCursor: unresolved ? scanCursor(request, items) : undefined,
  };
}

async function readBatches(
  request: RelayGroupPageRequest,
  segment: RelayPageSegment,
  segmentIndex: number,
  groupIndex: number,
  groupKey: string,
  batches: readonly LimitedRelayFilters[],
  attemptIndex: number,
) {
  const bounds = segmentBounds(segment);
  return mapAsyncBounded(batches, 4, async (batch, batchIndex) => {
    const filters = batch.filters.map((item) => mergeBounds(item, bounds));
    const read = await readScanBatch(request, groupKey, {
      segmentIndex,
      groupIndex,
      attemptIndex,
      batchIndex,
      relays: batch.relays,
      filters,
      maxEvents: batch.maxEvents,
    });
    void recordBatchCoverage(
      request,
      groupKey,
      batch.relays,
      filters,
      read,
      segment,
      attemptIndex,
    );
    return { read, filters, relays: batch.relays, maxEvents: batch.maxEvents };
  });
}

function readItems(
  request: RelayGroupPageRequest,
  segment: RelayPageSegment,
  cachedItems: readonly FeedEvent[],
  raw: readonly PoolEvent[],
) {
  const received = mergeFeedEvents([...cachedItems, ...mergePoolEvents(raw)]);
  return pageScanItems(received, {
    ...request,
    displayBounds: mergedDisplayBounds(request, segment),
  });
}
