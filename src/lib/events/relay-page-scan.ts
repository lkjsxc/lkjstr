import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import { limitedRelayFilterGroups } from './relay-page-limits';
import type { RelayGroupPageRequest } from './relay-page';
import { afterCursor, beforeCursor } from './repository-shared';
import type { FeedEvent } from './types';
import {
  mergeFeedEvents,
  mergePoolEvents,
  sortFeedEvents,
} from './relay-page-merge';
import { mergeBounds, positiveFilters } from './relay-page-filter';
import { relayPageWindows } from './relay-page-windows';
import { readPageDetailedCompat, statusesComplete } from './relay-page-status';

type WindowRead = {
  readonly items: FeedEvent[];
  readonly complete: boolean;
  readonly dense: boolean;
  readonly contacted: boolean;
};

export async function scanRelayFeedGroups(
  request: RelayGroupPageRequest,
): Promise<{ items: FeedEvent[]; hasMorePossible: boolean }> {
  const collected: FeedEvent[] = [];
  const windows = relayPageWindows({
    direction: request.direction ?? 'older',
    before: request.before,
    after: request.after,
  });
  for (const [windowIndex, bounds] of windows.entries()) {
    const window = await readWindow(request, bounds, windowIndex);
    collected.push(...window.items);
    const items = pageItems(collected, request);
    if (!window.contacted) continue;
    if (!window.complete || window.dense || items.length >= request.pageSize)
      return { items, hasMorePossible: true };
  }
  return { items: pageItems(collected, request), hasMorePossible: false };
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
  for (const [groupIndex, group] of request.groups.entries()) {
    if (group.relays.length === 0) continue;
    const read = await readGroup(request, bounds, windowIndex, groupIndex);
    pages.push(...read.items);
    complete = complete && read.complete;
    dense = dense || read.dense;
    contacted = contacted || read.contacted;
  }
  const items = pageItems(pages, request);
  return {
    items,
    complete,
    dense: dense || items.length >= request.pageSize,
    contacted,
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
      const result = await readPageDetailedCompat(request.subscriptions, {
        key: `${request.key}:${windowIndex}:${groupIndex}:${attempt}:${batchIndex}`,
        relays: batch.relays,
        filters: batch.filters.map((filter) =>
          mergeBounds(filter, windowBounds),
        ),
        purpose: request.purpose,
      });
      raw.push(...result.events);
      complete = complete && statusesComplete(result.statuses);
      dense =
        dense || denseResult(result.events, batch.filters, request.pageSize);
      contacted = true;
    }
    const items = pageItems(mergePoolEvents(raw), request);
    if (!needsCursorSlack(raw, items.length, request)) break;
  }
  const items = pageItems(mergePoolEvents(raw), request);
  return { items, complete, dense, contacted };
}

function pageItems(
  events: readonly FeedEvent[],
  request: Pick<RelayGroupPageRequest, 'before' | 'after' | 'pageSize'>,
): FeedEvent[] {
  return sortFeedEvents(mergeFeedEvents(events))
    .filter((item) => beforeCursor(item.event, request.before))
    .filter((item) => afterCursor(item.event, request.after))
    .slice(0, request.pageSize);
}

function denseResult(
  events: readonly PoolEvent[],
  filters: readonly NostrFilter[],
  pageSize: number,
): boolean {
  const limit = Math.max(
    1,
    Math.min(pageSize, ...filters.map((filter) => filter.limit ?? pageSize)),
  );
  const unique = new Set(events.map((item) => item.event.id)).size;
  return (
    events.length >= limit ||
    (events.length >= pageSize && unique < events.length)
  );
}

function needsCursorSlack(
  raw: readonly PoolEvent[],
  itemCount: number,
  request: RelayGroupPageRequest,
): boolean {
  return (
    Boolean(request.before || request.after) &&
    raw.length > itemCount &&
    itemCount < request.pageSize
  );
}

function slackFilters(filters: readonly NostrFilter[]): NostrFilter[] {
  return filters.map((filter) => ({
    ...filter,
    limit: (filter.limit ?? 1) * 2,
  }));
}
