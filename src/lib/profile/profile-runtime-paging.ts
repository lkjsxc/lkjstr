import { feedWindowSize } from '$lib/events/feed-window';
import { queryFeed } from '$lib/events/repository';
import { boundaryUntil, readRelayPage } from '$lib/events/relay-page';
import type { FeedCursorPoint, FeedEvent } from '$lib/events/types';
import { compareEventsDesc } from '$lib/protocol';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import { storeProfileEvent } from './profile-store';

export type ProfileOlderRequest = {
  readonly posts: readonly FeedEvent[];
  readonly pubkey: string;
  readonly relays: readonly string[];
  readonly subId: string;
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
};

export async function loadOlderProfilePage(request: ProfileOlderRequest) {
  const page = await queryFeed({
    kind: 'profile',
    authors: [request.pubkey],
    before: request.cursor,
    limit: request.pageSize,
  });
  const relayEvents = await readRelayPage({
    key: `${request.subId}:older:${request.cursor.createdAt}:${request.cursor.id}`,
    relays: request.relays,
    filters: [
      {
        kinds: [1],
        authors: [request.pubkey],
        until: boundaryUntil(request.cursor),
        limit: request.pageSize,
      },
    ],
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
  });
  await Promise.all(
    relayEvents.map((item) => storeProfileEvent(item.event, [item.relay])),
  );
  const posts = mergePosts(request.posts, [
    ...page.items,
    ...relayEvents.map((item) => ({
      event: item.event,
      relays: [item.relay],
    })),
  ]);
  const pruned = posts.length > feedWindowSize;
  return {
    posts: pruned ? posts.slice(-feedWindowSize) : posts,
    hasOlder: page.hasMore || relayEvents.length >= request.pageSize,
    newerPruned: pruned,
  };
}

function mergePosts(
  current: readonly FeedEvent[],
  incoming: readonly FeedEvent[],
): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of [...current, ...incoming]) {
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
