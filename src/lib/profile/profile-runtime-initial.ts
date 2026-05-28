import { feedWindowSize } from '$lib/events/feed-window';
import { feedEventsInDisplayBounds } from '$lib/events/feed-display-bounds';
import { isFeedDisplayKind } from '$lib/events/feed-kinds';
import { readRelayPage } from '$lib/events/relay-page';
import type { ProfileSummary } from '$lib/identity/identity';
import { getProfile } from '$lib/identity/profile-cache';
import { kinds, type NostrEvent } from '$lib/protocol';
import type { FeedEvent } from '$lib/events/types';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { pageIntentSemanticKey } from '$lib/relays/orchestration/page-reads';
import { planAuthorWriteRelays } from '$lib/relays/orchestration/route-plan';
import { readProfilePostsPageByIntent } from './profile-route-plans';
import { storeProfileEvent } from './profile-store';

type Request = {
  readonly posts: readonly FeedEvent[];
  readonly profile: ProfileSummary | null;
  readonly followList?: NostrEvent;
  readonly relays: readonly string[];
  readonly pubkey: string;
  readonly owner: string;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
};

export async function loadInitialProfilePage(request: Request) {
  const metadataRelays = await planAuthorWriteRelays({
    surface: 'profile',
    authors: [request.pubkey],
    selectedRelays: request.relays,
  });
  const [posts, metadata, follows] = await Promise.all([
    readProfilePostsPageByIntent({
      pubkey: request.pubkey,
      relays: request.relays,
      owner: request.owner,
      pageSize: request.pageSize,
      subscriptions: request.subscriptions,
      direction: 'initial',
      signal: request.signal,
    }),
    readRelayPage({
      key: pageIntentSemanticKey({
        surface: 'profile',
        owner: request.owner,
        phase: 'bootstrap',
        selectedRelays: metadataRelays,
        authors: [request.pubkey],
        pageSize: 2,
        direction: 'initial',
        purpose: 'metadata',
        relayFilters: [
          {
            kinds: [kinds.metadata, kinds.relayListMetadata],
            authors: [request.pubkey],
            limit: 2,
          },
        ],
      }),
      relays: metadataRelays,
      filters: [
        {
          kinds: [kinds.metadata, kinds.relayListMetadata],
          authors: [request.pubkey],
          limit: 2,
        },
      ],
      pageSize: 2,
      subscriptions: request.subscriptions,
      signal: request.signal,
      purpose: 'metadata',
    }),
    readRelayPage({
      key: pageIntentSemanticKey({
        surface: 'profile',
        owner: request.owner,
        phase: 'bootstrap',
        selectedRelays: request.relays,
        authors: [request.pubkey],
        pageSize: 1,
        direction: 'initial',
        purpose: 'metadata',
        relayFilters: [
          { kinds: [kinds.followList], authors: [request.pubkey], limit: 1 },
        ],
      }),
      relays: request.relays,
      filters: [
        { kinds: [kinds.followList], authors: [request.pubkey], limit: 1 },
      ],
      pageSize: 1,
      subscriptions: request.subscriptions,
      signal: request.signal,
      purpose: 'metadata',
    }),
  ]);
  await Promise.all(
    posts.items.map((item) => storeProfileEvent(item.event, item.relays)),
  );
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
      feedEventsInDisplayBounds(
        posts.items.filter((item) => isFeedDisplayKind(item.event.kind)),
      ),
    ),
    relays: [
      ...new Set([
        ...relayEvents.map((item) => item.relay),
        ...posts.items.flatMap((item) => item.relays),
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
