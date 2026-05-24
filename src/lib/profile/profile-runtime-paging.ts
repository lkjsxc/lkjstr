import { feedWindowSize, mergeFeedWindow } from '$lib/events/feed-window';
import { feedDisplayKinds } from '$lib/events/feed-kinds';
import { queryFeed } from '$lib/events/repository';
import { readRelayFeedGroups } from '$lib/events/relay-page';
import type { FeedCursorPoint, FeedEvent } from '$lib/events/types';
import { routeGroups } from '$lib/relays/relay-routing';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import {
  newerRelaySubscriptionId,
  olderRelaySubscriptionId,
} from '$lib/relays/subscription-id';
import { profileContentGroups } from './profile-relays';
import { storeProfileEvent } from './profile-store';

export type ProfileOlderRequest = {
  readonly posts: readonly FeedEvent[];
  readonly pubkey: string;
  readonly relays: readonly string[];
  readonly subId: string;
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
  readonly signal?: AbortSignal;
};

export type ProfileNewerRequest = ProfileOlderRequest;

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
    key: olderRelaySubscriptionId(request.subId, request.cursor),
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
    [...page.items, ...relayPage.items],
    feedWindowSize,
    true,
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
    key: newerRelaySubscriptionId(request.subId, request.cursor),
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
    [...page.items, ...relayPage.items],
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
