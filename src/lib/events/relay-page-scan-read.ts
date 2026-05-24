import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import { mergeSafeCursor, scanCursor } from './relay-page-scan-cursors';
import {
  logIncompleteScan,
  recordScanCoverage,
} from './relay-page-scan-diagnostics';
import { mergeBounds, positiveFilters } from './relay-page-filter';
import { limitedRelayFilterGroups } from './relay-page-limits';
import { mergeFeedEvents, mergePoolEvents } from './relay-page-merge';
import { needsCursorSlack, pageScanItems } from './relay-page-scan-items';
import { readScanBatch, type BatchReadResult } from './relay-page-scan-batch';
import {
  canSplitRelayPageSegment,
  type RelayPageSegment,
} from './relay-page-segments';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedCursorPoint, FeedEvent } from './types';

export type SegmentRead = {
  readonly items: FeedEvent[];
  readonly receivedItems: FeedEvent[];
  readonly complete: boolean;
  readonly dense: boolean;
  readonly contacted: boolean;
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
  let contacted = false;
  let safeCursor: FeedCursorPoint | undefined;
  for (const [groupIndex, group] of request.groups.entries()) {
    if (group.relays.length === 0) continue;
    const read = await readGroup(request, bounds, segmentIndex, groupIndex);
    received.push(...read.receivedItems);
    complete = complete && read.complete;
    dense = dense || read.dense;
    contacted = contacted || read.contacted;
    safeCursor = mergeSafeCursor(request, safeCursor, read.safeCursor);
  }
  return {
    items: pageScanItems(received, request),
    receivedItems: mergeFeedEvents(received),
    complete,
    dense,
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
  const raw: PoolEvent[] = [];
  let complete = true;
  let dense = false;
  let contacted = false;
  const baseFilters = positiveFilters(
    request.filters(group, segment),
    request.pageSize,
  );
  for (const [attemptIndex, attempt] of [1, 2, 4].entries()) {
    const batches = await limitedRelayFilterGroups(
      group.relays,
      scaleFilters(baseFilters, attempt),
      request.pageSize * attempt,
    );
    raw.length = 0;
    complete = true;
    dense = false;
    contacted = false;
    for (const [batchIndex, batch] of batches.entries()) {
      const filters = batch.filters.map((filter) =>
        mergeBounds(filter, segment),
      );
      const read = await readScanBatch(request, group.key, {
        segmentIndex,
        groupIndex,
        attemptIndex,
        batchIndex,
        relays: batch.relays,
        filters,
      });
      raw.push(...read.events);
      await recordBatchCoverage(
        request,
        group.key,
        batch.relays,
        filters,
        read,
        attemptIndex,
      );
      complete = complete && read.complete;
      dense = dense || read.dense;
      contacted = true;
    }
    const items = pageScanItems(mergePoolEvents(raw), request);
    if (dense && attempt < 4) continue;
    if (needsCursorSlack(raw, items.length, request) && attempt < 4) continue;
    break;
  }
  const items = pageScanItems(mergePoolEvents(raw), request);
  const unresolved = !complete || dense;
  if (unresolved && (!complete || !canSplitRelayPageSegment(segment)))
    await recordUnresolved(
      request,
      group.key,
      group.relays,
      baseFilters,
      segment,
      dense,
      raw,
    );
  return {
    items,
    receivedItems: mergePoolEvents(raw),
    complete,
    dense,
    contacted,
    safeCursor: unresolved ? scanCursor(request, items) : undefined,
  };
}

async function recordBatchCoverage(
  request: RelayGroupPageRequest,
  groupKey: string,
  relays: readonly string[],
  filters: readonly NostrFilter[],
  read: BatchReadResult,
  attempt: number,
): Promise<void> {
  await recordScanCoverage(
    request,
    groupKey,
    relays,
    filters,
    read.complete ? (read.dense ? 'dense' : 'complete') : 'incomplete',
    {
      reason: read.reason,
      limit: read.density.limit,
      eventCount: read.density.eventCount,
      uniqueCount: read.density.uniqueCount,
      attempt,
      durationMs: read.durationMs,
    },
  );
  if (!read.complete)
    logIncompleteScan(request, groupKey, filters[0] ?? {}, []);
}

async function recordUnresolved(
  request: RelayGroupPageRequest,
  groupKey: string,
  relays: readonly string[],
  filters: readonly NostrFilter[],
  segment: RelayPageSegment,
  dense: boolean,
  raw: readonly PoolEvent[],
): Promise<void> {
  await recordScanCoverage(
    request,
    groupKey,
    relays,
    filters.map((filter) => mergeBounds(filter, segment)),
    'unresolved',
    {
      reason: dense ? 'dense-minimum-or-budget' : 'incomplete-minimum',
      limit: request.pageSize,
      eventCount: raw.length,
      uniqueCount: new Set(raw.map((item) => item.event.id)).size,
      attempt: 4,
    },
  );
}

function scaleFilters(
  filters: readonly NostrFilter[],
  multiplier: number,
): NostrFilter[] {
  return filters.map((filter) => ({
    ...filter,
    limit: (filter.limit ?? 1) * multiplier,
  }));
}
