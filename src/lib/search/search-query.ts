import { feedDisplayKinds } from '$lib/events/feed-kinds';
import { beforeCursor } from '$lib/events/repository-shared';
import { boundaryUntil, readRelayFeedPage } from '$lib/events/relay-page';
import { eventsMatching, upsertEvent } from '$lib/events/repository';
import type { FeedCursorPoint, FeedEvent } from '$lib/events/types';
import { compareEventsDesc } from '$lib/protocol';
import { relayMaySupportNip50 } from '$lib/relays/relay-info';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import { initialRelaySubscriptionId } from '$lib/relays/subscription-id';

export type SearchPageRequest = {
  readonly query: string;
  readonly relays: readonly string[];
  readonly subId: string;
  readonly subscriptions: RelaySubscriptionManager;
  readonly limit: number;
  readonly before?: FeedCursorPoint;
};

export async function searchPage(
  request: SearchPageRequest,
): Promise<{ items: FeedEvent[]; hasOlder: boolean }> {
  const query = request.query.trim();
  if (!query) return { items: [], hasOlder: false };
  const [local, relay] = await Promise.all([
    cachedSearch(query, request.limit, request.before),
    relaySearch(request, query),
  ]);
  const merged = mergeItems([...local, ...relay]);
  return {
    items: merged.slice(0, request.limit),
    hasOlder: merged.length > request.limit || relay.length >= request.limit,
  };
}

async function relaySearch(
  request: SearchPageRequest,
  query: string,
): Promise<FeedEvent[]> {
  const relayItems = await readRelayFeedPage({
    key: initialRelaySubscriptionId(
      request.subId,
      `${query}:${request.before?.createdAt ?? 0}:${request.before?.id ?? ''}`,
    ),
    relays: await searchRelays(request.relays),
    filters: [
      {
        kinds: feedDisplayKinds,
        search: query,
        limit: request.limit,
        until: boundaryUntil(request.before),
      },
    ],
    before: request.before,
    pageSize: request.limit + 1,
    subscriptions: request.subscriptions,
    purpose: 'search',
  });
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
  );
  return relayItems;
}

async function searchRelays(relays: readonly string[]): Promise<string[]> {
  const support = await Promise.all(
    relays.map(async (relay) => ({
      relay,
      supported: await relayMaySupportNip50(relay),
    })),
  );
  return support.filter((item) => item.supported).map((item) => item.relay);
}

async function cachedSearch(
  query: string,
  limit: number,
  before?: FeedCursorPoint,
): Promise<FeedEvent[]> {
  const needle = query.toLowerCase();
  const events = await eventsMatching([
    { kinds: feedDisplayKinds, until: boundaryUntil(before) },
  ]);
  return events
    .filter((item) => beforeCursor(item.event, before))
    .filter((item) => item.event.content.toLowerCase().includes(needle))
    .slice(0, limit + 1);
}

function mergeItems(items: readonly FeedEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of items) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeItem(existing, item) : item);
  }
  return [...byId.values()].sort((a, b) => compareEventsDesc(a.event, b.event));
}

function mergeItem(a: FeedEvent, b: FeedEvent): FeedEvent {
  return {
    event: a.event.created_at >= b.event.created_at ? a.event : b.event,
    relays: [...new Set([...a.relays, ...b.relays])],
  };
}
