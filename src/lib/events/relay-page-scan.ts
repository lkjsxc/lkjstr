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

const maxDenseAttempts = 3;

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
  let bounds = windowBounds;
  let complete = true;
  let dense = false;
  let contacted = false;
  for (let attempt = 0; attempt < maxDenseAttempts; attempt += 1) {
    const filters = positiveFilters(
      request.filters(group, bounds),
      request.pageSize,
    );
    const batches = await limitedRelayFilterGroups(
      group.relays,
      filters,
      request.pageSize,
    );
    if (batches.length === 0) break;
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
    if (!complete || !dense || items.length >= request.pageSize) break;
    const next = internalBounds(windowBounds, raw, request);
    if (!next || sameBounds(next, bounds)) break;
    bounds = next;
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
    ...filters.map((filter) => filter.limit ?? pageSize),
    pageSize,
  );
  const unique = new Set(events.map((item) => item.event.id)).size;
  return (
    events.length >= limit ||
    (events.length >= pageSize && unique < events.length)
  );
}

function internalBounds(
  windowBounds: Pick<NostrFilter, 'since' | 'until'>,
  raw: readonly PoolEvent[],
  request: RelayGroupPageRequest,
): Pick<NostrFilter, 'since' | 'until'> | undefined {
  const events = sortFeedEvents(mergePoolEvents(raw))
    .filter((item) => beforeCursor(item.event, request.before))
    .filter((item) => afterCursor(item.event, request.after));
  if (events.length === 0 && request.direction === 'newer' && request.after)
    return { ...windowBounds, since: request.after.createdAt + 1 };
  if (events.length === 0 && request.before)
    return {
      ...windowBounds,
      until: Math.max(0, request.before.createdAt - 1),
    };
  if (events.length === 0) return undefined;
  if (request.direction === 'newer') {
    const newest = events[0]!.event;
    return { ...windowBounds, since: Math.max(0, newest.created_at + 1) };
  }
  const oldest = events.at(-1)!.event;
  return { ...windowBounds, until: Math.max(0, oldest.created_at - 1) };
}

function sameBounds(
  a: Pick<NostrFilter, 'since' | 'until'>,
  b: Pick<NostrFilter, 'since' | 'until'>,
): boolean {
  return a.since === b.since && a.until === b.until;
}
