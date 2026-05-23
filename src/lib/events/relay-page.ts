import type { NostrFilter } from '../protocol';
import { compareEventsDesc } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import type { FeedCursorPoint, FeedEvent } from './types';
import { afterCursor, beforeCursor } from './repository-shared';

export type RelayPageRequest = {
  readonly key: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly subscriptions: RelaySubscriptionManager;
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
  readonly pageSize: number;
};

export async function readRelayPage(
  request: RelayPageRequest,
): Promise<PoolEvent[]> {
  if (request.relays.length === 0) return [];
  return request.subscriptions.readPage({
    key: request.key,
    relays: request.relays,
    filters: request.filters,
  });
}

export async function readRelayFeedPage(
  request: RelayPageRequest,
): Promise<FeedEvent[]> {
  if (request.relays.length === 0) return [];
  const events = await request.subscriptions.readPage({
    key: request.key,
    relays: request.relays,
    filters: request.filters.map((filter) =>
      boundaryFilter(filter, request.before, request.after),
    ),
  });
  return mergeEvents(events)
    .filter((item) => beforeCursor(item.event, request.before))
    .filter((item) => afterCursor(item.event, request.after))
    .sort((a, b) => compareEventsDesc(a.event, b.event))
    .slice(0, request.pageSize);
}

export function boundaryUntil(
  cursor: FeedCursorPoint | undefined,
): number | undefined {
  return cursor ? cursor.createdAt + 1 : undefined;
}

export function boundarySince(
  cursor: FeedCursorPoint | undefined,
): number | undefined {
  if (!cursor) return undefined;
  return Math.max(0, cursor.createdAt - 1);
}

function boundaryFilter(
  filter: NostrFilter,
  before?: FeedCursorPoint,
  after?: FeedCursorPoint,
): NostrFilter {
  const until = min(filter.until, boundaryUntil(before));
  const since = max(filter.since, boundarySince(after));
  return { ...filter, until, since };
}

function mergeEvents(events: readonly PoolEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of events) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, {
      event: existing?.event ?? item.event,
      relays: [...new Set([...(existing?.relays ?? []), item.relay])].sort(),
    });
  }
  return [...byId.values()];
}

function min(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.min(left, right);
}

function max(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}
