import { feedWindowSize, mergeFeedWindow } from '$lib/events/feed-window';
import { feedEventsInDisplayBounds } from '$lib/events/feed-display-bounds';
import { queryFeed } from '$lib/events/repository';
import type { FeedCursorPoint, FeedEvent } from '$lib/events/types';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { readProfilePostsPageByIntent } from './profile-route-plans';
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
  const relayPage = await readProfilePostsPageByIntent({
    pubkey: request.pubkey,
    relays: request.relays,
    owner: request.owner,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    direction: 'older',
    cursor: request.cursor,
    signal: request.signal,
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
  const relayPage = await readProfilePostsPageByIntent({
    pubkey: request.pubkey,
    relays: request.relays,
    owner: request.owner,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    direction: 'newer',
    cursor: request.cursor,
    signal: request.signal,
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
