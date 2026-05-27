import { feedWindowSize, mergeFeedWindow } from '$lib/events/feed-window';
import { feedEventsInDisplayBounds } from '$lib/events/feed-display-bounds';
import { feedDisplayKinds } from '$lib/events/feed-kinds';
import { queryFeed } from '$lib/events/repository';
import { readRelayFeedGroups } from '$lib/events/relay-page';
import type { FeedCursorPoint, FeedEvent } from '$lib/events/types';
import { routeGroups } from '$lib/relays/relay-routing';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { pageIntentSemanticKey } from '$lib/relays/orchestration/page-reads';
import { profileContentGroups } from './profile-relays';
import { storeProfileEvent } from './profile-store';

export type ProfileOlderRequest = {
  readonly posts: readonly FeedEvent[];
  readonly pubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
  readonly preserve?: ProfileOlderPreserveMode;
};

export type ProfileNewerRequest = ProfileOlderRequest;
export type ProfileOlderPreserveMode = 'newer' | 'older';

export async function loadOlderProfilePage(request: ProfileOlderRequest) {
  const page = await queryFeed({
    kind: 'profile',
    authors: [request.pubkey],
    before: request.cursor,
    limit: request.pageSize,
  });
  const groups = profileContentGroups(
    await routeGroups({
      authors: [request.pubkey],
      selectedRelays: request.relays,
      purpose: 'write',
    }),
    request.relays,
  );
  const relayPage = await readRelayFeedGroups({
    key: pageIntentSemanticKey({
      surface: 'profile',
      owner: request.owner,
      phase: 'page',
      selectedRelays: request.relays,
      authors: [request.pubkey],
      pageSize: request.pageSize,
      direction: 'older',
      cursor: request.cursor,
      purpose: 'feed',
    }),
    groups,
    filters: (_group, bounds) => [
      {
        kinds: feedDisplayKinds,
        authors: [request.pubkey],
        ...bounds,
        limit: request.pageSize,
      },
    ],
    direction: 'older',
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    signal: request.signal,
    purpose: 'feed',
  });
  await Promise.all(
    relayPage.items.map((item) => storeProfileEvent(item.event, item.relays)),
  );
  const window = mergeFeedWindow(
    request.posts,
    feedEventsInDisplayBounds([...page.items, ...relayPage.items], {
      before: request.cursor,
    }),
    feedWindowSize,
    request.preserve === 'older',
  );
  return {
    posts: window.items,
    hasOlder: page.hasMore || relayPage.hasMorePossible,
    newerPruned: window.prunedNewer,
    nextOlderCursor: relayPage.nextCursor,
    incomplete: relayPage.incomplete,
  };
}

export async function loadNewerProfilePage(request: ProfileNewerRequest) {
  const page = await queryFeed({
    kind: 'profile',
    authors: [request.pubkey],
    after: request.cursor,
    limit: request.pageSize,
  });
  const groups = profileContentGroups(
    await routeGroups({
      authors: [request.pubkey],
      selectedRelays: request.relays,
      purpose: 'write',
    }),
    request.relays,
  );
  const relayPage = await readRelayFeedGroups({
    key: pageIntentSemanticKey({
      surface: 'profile',
      owner: request.owner,
      phase: 'page',
      selectedRelays: request.relays,
      authors: [request.pubkey],
      pageSize: request.pageSize,
      direction: 'newer',
      cursor: request.cursor,
      purpose: 'feed',
    }),
    groups,
    filters: (_group, bounds) => [
      {
        kinds: feedDisplayKinds,
        authors: [request.pubkey],
        ...bounds,
        limit: request.pageSize,
      },
    ],
    direction: 'newer',
    after: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    signal: request.signal,
    purpose: 'feed',
  });
  await Promise.all(
    relayPage.items.map((item) => storeProfileEvent(item.event, item.relays)),
  );
  const window = mergeFeedWindow(
    request.posts,
    feedEventsInDisplayBounds([...page.items, ...relayPage.items], {
      after: request.cursor,
    }),
    feedWindowSize,
  );
  return {
    posts: window.items,
    hasNewer: page.hasMore || relayPage.hasMorePossible,
    olderPruned: window.prunedOlder,
    nextNewerCursor: relayPage.nextCursor,
    incomplete: relayPage.incomplete,
  };
}
