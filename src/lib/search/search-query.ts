import { feedDisplayKinds } from '$lib/events/feed-kinds';
import { readRelayPage } from '$lib/events/relay-page';
import { eventsMatching, upsertEvent } from '$lib/events/repository';
import type { FeedEvent } from '$lib/events/types';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import { initialRelaySubscriptionId } from '$lib/relays/subscription-id';

export type SearchPageRequest = {
  readonly query: string;
  readonly relays: readonly string[];
  readonly subId: string;
  readonly subscriptions: RelaySubscriptionManager;
  readonly limit: number;
  readonly until?: number;
};

export async function searchPage(
  request: SearchPageRequest,
): Promise<{ items: FeedEvent[]; hasOlder: boolean }> {
  const query = request.query.trim();
  if (!query) return { items: [], hasOlder: false };
  const [local, relay] = await Promise.all([
    cachedSearch(query, request.limit, request.until),
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
  const relayEvents = await readRelayPage({
    key: initialRelaySubscriptionId(
      request.subId,
      `${query}:${request.until ?? 0}`,
    ),
    relays: request.relays,
    filters: [
      {
        kinds: feedDisplayKinds,
        search: query,
        limit: request.limit,
        until: request.until,
      },
    ],
    pageSize: request.limit + 1,
    subscriptions: request.subscriptions,
  });
  await Promise.all(
    relayEvents.map((item) => upsertEvent(item.event, [item.relay])),
  );
  return relayEvents.map((item) => ({
    event: item.event,
    relays: [item.relay],
  }));
}

async function cachedSearch(
  query: string,
  limit: number,
  until?: number,
): Promise<FeedEvent[]> {
  const needle = query.toLowerCase();
  const events = await eventsMatching([{ kinds: feedDisplayKinds, until }]);
  return events
    .filter((item) => item.event.content.toLowerCase().includes(needle))
    .slice(0, limit + 1);
}

function mergeItems(items: readonly FeedEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of items) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeItem(existing, item) : item);
  }
  return [...byId.values()].sort(
    (a, b) => b.event.created_at - a.event.created_at,
  );
}

function mergeItem(a: FeedEvent, b: FeedEvent): FeedEvent {
  return {
    event: a.event.created_at >= b.event.created_at ? a.event : b.event,
    relays: [...new Set([...a.relays, ...b.relays])],
  };
}
