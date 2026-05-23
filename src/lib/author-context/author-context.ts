import { feedDisplayKinds } from '$lib/events/feed-kinds';
import { cursorPoint } from '$lib/events/feed-window';
import { lookupEvent, queryFeed, upsertEvent } from '$lib/events/repository';
import { readRelayFeedPage, readRelayPage } from '$lib/events/relay-page';
import type { FeedEvent } from '$lib/events/types';
import { compareEventsDesc, type NostrEvent } from '$lib/protocol';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';

export type AuthorContextRequest = {
  readonly eventId: string;
  readonly pubkey: string;
  readonly relays: readonly string[];
  readonly subId: string;
  readonly subscriptions: RelaySubscriptionManager;
};

export async function loadAuthorContext(
  request: AuthorContextRequest,
): Promise<FeedEvent[]> {
  const anchor = await loadAnchor(request);
  if (!anchor) return [];
  const cursor = cursorPoint(anchor);
  const [olderCache, newerCache, relayEvents] = await Promise.all([
    queryFeed({
      kind: 'profile',
      authors: [request.pubkey],
      before: cursor,
      limit: 10,
    }),
    queryFeed({
      kind: 'profile',
      authors: [request.pubkey],
      after: cursor,
      limit: 10,
    }),
    readRelayFeedPage({
      key: request.subId,
      relays: request.relays,
      filters: [
        {
          kinds: feedDisplayKinds,
          authors: [request.pubkey],
          until: anchor.event.created_at,
          limit: 10,
        },
        {
          kinds: feedDisplayKinds,
          authors: [request.pubkey],
          since: anchor.event.created_at,
          limit: 11,
        },
      ],
      pageSize: 22,
      subscriptions: request.subscriptions,
      purpose: 'feed',
    }),
  ]);
  await Promise.all(
    relayEvents.map((item) => upsertEvent(item.event, item.relays)),
  );
  return merge([
    ...newerCache.items,
    anchor,
    ...olderCache.items,
    ...relayEvents,
  ]);
}

async function loadAnchor(
  request: AuthorContextRequest,
): Promise<FeedEvent | undefined> {
  const cached = await lookupEvent(request.eventId);
  if (cached) return cached;
  const [relay] = await readRelayPage({
    key: `${request.subId}:anchor`,
    relays: request.relays,
    filters: [{ ids: [request.eventId], authors: [request.pubkey], limit: 1 }],
    pageSize: 1,
    subscriptions: request.subscriptions,
    purpose: 'event-lookup',
  });
  if (!relay) return undefined;
  await upsertEvent(relay.event, [relay.relay]);
  return { event: relay.event, relays: [relay.relay] };
}

function merge(items: readonly FeedEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of items) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeItem(existing, item) : item);
  }
  return [...byId.values()].sort((a, b) => compareEventsDesc(a.event, b.event));
}

function mergeItem(a: FeedEvent, b: FeedEvent): FeedEvent {
  return {
    event: newer(a.event, b.event),
    relays: [...new Set([...a.relays, ...b.relays])],
  };
}

function newer(a: NostrEvent, b: NostrEvent): NostrEvent {
  return compareEventsDesc(a, b) <= 0 ? a : b;
}
