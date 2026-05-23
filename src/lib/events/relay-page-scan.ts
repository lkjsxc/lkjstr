import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import { countRuntime } from '../app/runtime-counters';
import {
  mergeSafeCursor,
  nextScanCursor,
  scanCursor,
} from './relay-page-scan-cursors';
import {
  logIncompleteScan,
  recordScanCoverage,
} from './relay-page-scan-diagnostics';
import { limitedRelayFilterGroups } from './relay-page-limits';
import type { RelayGroupPageRequest, RelayGroupPageResult } from './relay-page';
import type { FeedCursorPoint, FeedEvent } from './types';
import { mergePoolEvents } from './relay-page-merge';
import {
  denseScanResult,
  needsCursorSlack,
  pageScanItems,
  slackFilters,
} from './relay-page-scan-items';
import { mergeBounds, positiveFilters } from './relay-page-filter';
import { relayPageWindows } from './relay-page-windows';
import { readPageDetailedCompat, statusesComplete } from './relay-page-status';

type WindowRead = {
  readonly items: FeedEvent[];
  readonly complete: boolean;
  readonly dense: boolean;
  readonly contacted: boolean;
  readonly safeCursor?: FeedCursorPoint;
};

export async function scanRelayFeedGroups(
  request: RelayGroupPageRequest,
): Promise<RelayGroupPageResult> {
  countRuntime('timeline', 'scanReads');
  const collected: FeedEvent[] = [];
  const windows = relayPageWindows({
    direction: request.direction ?? 'older',
    before: request.before,
    after: request.after,
  });
  for (const [windowIndex, bounds] of windows.entries()) {
    const window = await readWindow(request, bounds, windowIndex);
    collected.push(...window.items);
    const items = pageScanItems(collected, request);
    if (!window.contacted) continue;
    if (!window.complete) countRuntime('timeline', 'incompleteWindows');
    if (window.dense) countRuntime('timeline', 'denseWindows');
    if (!window.complete || window.dense || items.length >= request.pageSize)
      return result(request, items, true, window);
  }
  return result(request, pageScanItems(collected, request), false);
}

async function readWindow(
  request: RelayGroupPageRequest,
  bounds: Pick<NostrFilter, 'since' | 'until'>,
  windowIndex: number,
): Promise<WindowRead> {
  const pages: FeedEvent[] = [];
  let complete = true;
  let dense = false;
  let contacted = false;
  let safeCursor: FeedCursorPoint | undefined;
  for (const [groupIndex, group] of request.groups.entries()) {
    if (group.relays.length === 0) continue;
    const read = await readGroup(request, bounds, windowIndex, groupIndex);
    pages.push(...read.items);
    complete = complete && read.complete;
    dense = dense || read.dense;
    contacted = contacted || read.contacted;
    safeCursor = mergeSafeCursor(request, safeCursor, read.safeCursor);
  }
  const items = pageScanItems(pages, request);
  const windowDense = dense || items.length >= request.pageSize;
  return {
    items,
    complete,
    dense: windowDense,
    contacted,
    safeCursor: windowDense
      ? (safeCursor ?? scanCursor(request, items))
      : safeCursor,
  };
}

async function readGroup(
  request: RelayGroupPageRequest,
  windowBounds: Pick<NostrFilter, 'since' | 'until'>,
  windowIndex: number,
  groupIndex: number,
): Promise<WindowRead> {
  const group = request.groups[groupIndex]!;
  const raw: PoolEvent[] = [];
  let complete = true;
  let dense = false;
  let contacted = false;
  const baseFilters = positiveFilters(
    request.filters(group, windowBounds),
    request.pageSize,
  );
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const filters = attempt === 0 ? baseFilters : slackFilters(baseFilters);
    const batches = await limitedRelayFilterGroups(
      group.relays,
      filters,
      request.pageSize,
    );
    for (const [batchIndex, batch] of batches.entries()) {
      const filters = batch.filters.map((filter) =>
        mergeBounds(filter, windowBounds),
      );
      const result = await readBatch(
        request,
        group.key,
        windowIndex,
        groupIndex,
        attempt,
        batchIndex,
        batch.relays,
        filters,
      );
      raw.push(...result.events);
      const statusComplete = statusesComplete(result.statuses);
      const resultDense = denseScanResult(
        result.events,
        batch.filters,
        request.pageSize,
      );
      await recordScanCoverage(
        request,
        group.key,
        batch.relays,
        filters,
        statusComplete ? (resultDense ? 'dense' : 'complete') : 'incomplete',
      );
      if (statusComplete && !resultDense)
        countRuntime('timeline', 'completedCoverageWindows');
      if (!statusComplete)
        logIncompleteScan(request, group.key, windowBounds, result.statuses);
      complete = complete && statusComplete;
      dense = dense || resultDense;
      contacted = true;
    }
    const items = pageScanItems(mergePoolEvents(raw), request);
    if (!needsCursorSlack(raw, items.length, request)) break;
  }
  const items = pageScanItems(mergePoolEvents(raw), request);
  return {
    items,
    complete,
    dense,
    contacted,
    safeCursor: !complete || dense ? scanCursor(request, items) : undefined,
  };
}

async function readBatch(
  request: RelayGroupPageRequest,
  groupKey: string,
  windowIndex: number,
  groupIndex: number,
  attempt: number,
  batchIndex: number,
  relays: readonly string[],
  filters: readonly NostrFilter[],
) {
  try {
    return await readPageDetailedCompat(request.subscriptions, {
      key: `${request.key}:${windowIndex}:${groupIndex}:${attempt}:${batchIndex}`,
      relays,
      filters,
      purpose: request.purpose,
    });
  } catch (error) {
    await recordScanCoverage(request, groupKey, relays, filters, 'failed');
    throw error;
  }
}

function result(
  request: RelayGroupPageRequest,
  items: FeedEvent[],
  hasMorePossible: boolean,
  window?: WindowRead,
): RelayGroupPageResult {
  return {
    items,
    hasMorePossible,
    nextCursor: nextScanCursor(request, items, window?.safeCursor),
    incomplete: Boolean(window && !window.complete),
    dense: Boolean(window?.dense),
  };
}
