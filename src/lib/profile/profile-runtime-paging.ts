import { feedWindowSize, mergeFeedWindow } from '$lib/events/feed-window';
import { feedDisplayKinds } from '$lib/events/feed-kinds';
import { queryFeed } from '$lib/events/repository';
import {
  boundarySince,
  boundaryUntil,
  readRelayFeedPage,
} from '$lib/events/relay-page';
import type { FeedCursorPoint, FeedEvent } from '$lib/events/types';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import { olderRelaySubscriptionId } from '$lib/relays/subscription-id';
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

export type ProfileNewerRequest = ProfileOlderRequest;

export async function loadOlderProfilePage(request: ProfileOlderRequest) {
  const page = await queryFeed({
    kind: 'profile',
    authors: [request.pubkey],
    before: request.cursor,
    limit: request.pageSize,
  });
  const relayItems = await readRelayFeedPage({
    key: olderRelaySubscriptionId(request.subId, request.cursor),
    relays: request.relays,
    filters: [
      {
        kinds: feedDisplayKinds,
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
    relayItems.map((item) => storeProfileEvent(item.event, item.relays)),
  );
  const window = mergeFeedWindow(
    request.posts,
    [...page.items, ...relayItems],
    feedWindowSize,
    true,
  );
  return {
    posts: window.items,
    hasOlder: page.hasMore || relayItems.length >= request.pageSize,
    newerPruned: window.prunedNewer,
  };
}

export async function loadNewerProfilePage(request: ProfileNewerRequest) {
  const page = await queryFeed({
    kind: 'profile',
    authors: [request.pubkey],
    after: request.cursor,
    limit: request.pageSize,
  });
  const relayItems = await readRelayFeedPage({
    key: olderRelaySubscriptionId(request.subId, request.cursor),
    relays: request.relays,
    filters: [
      {
        kinds: feedDisplayKinds,
        authors: [request.pubkey],
        since: boundarySince(request.cursor),
        limit: request.pageSize,
      },
    ],
    after: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
  });
  await Promise.all(
    relayItems.map((item) => storeProfileEvent(item.event, item.relays)),
  );
  const window = mergeFeedWindow(
    request.posts,
    [...page.items, ...relayItems],
    feedWindowSize,
  );
  return {
    posts: window.items,
    hasNewer: page.hasMore || relayItems.length >= request.pageSize,
    olderPruned: window.prunedOlder,
  };
}
