import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import type { FeedCursorPoint } from './types';
import { beforeCursor } from './repository-shared';

export type RelayPageRequest = {
  readonly key: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly subscriptions: RelaySubscriptionManager;
  readonly before?: FeedCursorPoint;
  readonly pageSize: number;
};

export async function readRelayPage(
  request: RelayPageRequest,
): Promise<PoolEvent[]> {
  if (request.relays.length === 0) return [];
  const events = await request.subscriptions.readPage({
    key: request.key,
    relays: request.relays,
    filters: request.filters.map((filter) =>
      request.before ? boundaryFilter(filter, request.before) : filter,
    ),
  });
  return dedupe(events)
    .filter((item) => beforeCursor(item.event, request.before))
    .slice(0, request.pageSize);
}

export function boundaryUntil(
  cursor: FeedCursorPoint | undefined,
): number | undefined {
  return cursor ? cursor.createdAt + 1 : undefined;
}

function boundaryFilter(
  filter: NostrFilter,
  cursor: FeedCursorPoint,
): NostrFilter {
  return { ...filter, until: boundaryUntil(cursor) };
}

function dedupe(events: readonly PoolEvent[]): PoolEvent[] {
  const byId = new Map<string, PoolEvent>();
  for (const item of events) {
    const existing = byId.get(item.event.id);
    if (!existing) byId.set(item.event.id, item);
  }
  return [...byId.values()];
}
