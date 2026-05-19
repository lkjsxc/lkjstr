import { feedWindowSize } from '$lib/events/feed-window';
import { queryFeed } from '$lib/events/repository';
import { boundaryUntil, readRelayPage } from '$lib/events/relay-page';
import type { FeedCursorPoint } from '$lib/events/types';
import { compareEventsDesc, type NostrEvent } from '$lib/protocol';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import { storeProfileEvent } from './profile-store';

export type ProfileOlderRequest = {
  readonly posts: readonly NostrEvent[];
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
    ...page.items.map((item) => item.event),
    ...relayEvents.map((item) => item.event),
  ]);
  const pruned = posts.length > feedWindowSize;
  return {
    posts: pruned ? posts.slice(-feedWindowSize) : posts,
    hasOlder: page.hasMore || relayEvents.length >= request.pageSize,
    newerPruned: pruned,
  };
}

function mergePosts(
  current: readonly NostrEvent[],
  incoming: readonly NostrEvent[],
): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  [...current, ...incoming].forEach((event) => byId.set(event.id, event));
  return [...byId.values()].sort(compareEventsDesc);
}
