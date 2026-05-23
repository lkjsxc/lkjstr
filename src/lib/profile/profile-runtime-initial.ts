import { feedWindowSize } from '$lib/events/feed-window';
import { feedDisplayKinds, isFeedDisplayKind } from '$lib/events/feed-kinds';
import { readRelayFeedPage, readRelayPage } from '$lib/events/relay-page';
import type { ProfileSummary } from '$lib/identity/identity';
import { getProfile } from '$lib/identity/profile-cache';
import type { NostrEvent } from '$lib/protocol';
import type { FeedEvent } from '$lib/events/types';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import { initialRelaySubscriptionId } from '$lib/relays/subscription-id';
import { storeProfileEvent } from './profile-store';

type Request = {
  readonly posts: readonly FeedEvent[];
  readonly profile: ProfileSummary | null;
  readonly followList?: NostrEvent;
  readonly relays: readonly string[];
  readonly pubkey: string;
  readonly subId: string;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
};

export async function loadInitialProfilePage(request: Request) {
  const key = initialRelaySubscriptionId(request.subId, request.pubkey);
  const [metadata, follows, posts] = await Promise.all([
    readRelayPage({
      key: `${key}:meta`,
      relays: request.relays,
      filters: [{ kinds: [0], authors: [request.pubkey], limit: 1 }],
      pageSize: 1,
      subscriptions: request.subscriptions,
    }),
    readRelayPage({
      key: `${key}:follows`,
      relays: request.relays,
      filters: [{ kinds: [3], authors: [request.pubkey], limit: 1 }],
      pageSize: 1,
      subscriptions: request.subscriptions,
    }),
    readRelayFeedPage({
      key: `${key}:posts`,
      relays: request.relays,
      filters: [
        {
          kinds: feedDisplayKinds,
          authors: [request.pubkey],
          limit: request.pageSize,
        },
      ],
      pageSize: request.pageSize,
      subscriptions: request.subscriptions,
    }),
  ]);
  const relayEvents = [...metadata, ...follows];
  const storedProfiles = await Promise.all(
    relayEvents.map((item) => storeProfileEvent(item.event, [item.relay])),
  );
  const profile =
    getProfile(request.pubkey) ?? storedProfiles.find((item) => item);
  const followList = latestEvent(
    relayEvents.map((item) => item.event).filter((event) => event.kind === 3),
    request.followList,
  );
  return {
    profile: profile ?? request.profile,
    followList,
    posts: mergePosts(
      request.posts,
      posts.filter((item) => isFeedDisplayKind(item.event.kind)),
    ),
    relays: [
      ...new Set([
        ...relayEvents.map((item) => item.relay),
        ...posts.flatMap((item) => item.relays),
      ]),
    ],
  };
}

function latestEvent(
  events: readonly NostrEvent[],
  fallback?: NostrEvent,
): NostrEvent | undefined {
  return [...events, ...(fallback ? [fallback] : [])].sort(
    (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id),
  )[0];
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
  return [...byId.values()]
    .sort((a, b) => b.event.created_at - a.event.created_at)
    .slice(0, feedWindowSize);
}

function mergeItem(a: FeedEvent, b: FeedEvent): FeedEvent {
  return {
    event: a.event.created_at >= b.event.created_at ? a.event : b.event,
    relays: [...new Set([...a.relays, ...b.relays])],
  };
}
