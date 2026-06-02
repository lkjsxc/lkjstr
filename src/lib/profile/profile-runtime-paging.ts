import { feedEventsInDisplayBounds } from '$lib/events/feed-display-bounds';
import { readCacheFirstFeedPage } from '$lib/events/feed-page-cache-first';
import { feedWindowSize, mergeFeedWindow } from '$lib/events/feed-window';
import { queryFeed } from '$lib/events/repository';
import type { FeedCursorPoint, FeedEvent } from '$lib/events/types';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import {
  planProfilePostsPageByIntent,
  readProfilePostsPageByIntent,
  type ProfilePostsPageRequest,
} from './profile-route-plans';
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
  const planRequest = profilePlanRequest(request, 'older');
  const plan = await planProfilePostsPageByIntent(planRequest);
  const cache = await readCacheFirstFeedPage({
    plan,
    subscriptions: request.subscriptions,
  });
  if (cache.kind !== 'miss') {
    if (cache.kind === 'partial-cache')
      void readAndStoreProfile(planRequest).catch(() => undefined);
    return olderProfileFromCache(request, cache.page);
  }
  const [page, relayPage] = await Promise.all([
    queryFeed({
      kind: 'profile',
      authors: [request.pubkey],
      before: request.cursor,
      limit: request.pageSize,
    }),
    readAndStoreProfile(planRequest),
  ]);
  const window = profileWindow(
    request,
    [...page.items, ...relayPage.items],
    'older',
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
  const planRequest = profilePlanRequest(request, 'newer');
  const plan = await planProfilePostsPageByIntent(planRequest);
  const cache = await readCacheFirstFeedPage({
    plan,
    subscriptions: request.subscriptions,
  });
  if (cache.kind !== 'miss') {
    if (cache.kind === 'partial-cache')
      void readAndStoreProfile(planRequest).catch(() => undefined);
    return newerProfileFromCache(request, cache.page);
  }
  const [page, relayPage] = await Promise.all([
    queryFeed({
      kind: 'profile',
      authors: [request.pubkey],
      after: request.cursor,
      limit: request.pageSize,
    }),
    readAndStoreProfile(planRequest),
  ]);
  const window = profileWindow(
    request,
    [...page.items, ...relayPage.items],
    'newer',
  );
  return {
    posts: window.items,
    hasNewer: page.hasMore || relayPage.hasMorePossible,
    olderPruned: window.prunedOlder,
    nextNewerCursor: relayPage.nextCursor,
    incomplete: relayPage.incomplete,
  };
}

function profilePlanRequest(
  request: ProfileOlderRequest,
  direction: 'older' | 'newer',
): ProfilePostsPageRequest {
  return {
    pubkey: request.pubkey,
    relays: request.relays,
    owner: request.owner,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    direction,
    cursor: request.cursor,
    signal: request.signal,
  };
}

async function readAndStoreProfile(request: ProfilePostsPageRequest) {
  const relayPage = await readProfilePostsPageByIntent(request);
  await Promise.all(
    relayPage.items.map((item) => storeProfileEvent(item.event, item.relays)),
  );
  return relayPage;
}

function profileWindow(
  request: ProfileOlderRequest,
  incoming: readonly FeedEvent[],
  direction: 'older' | 'newer',
) {
  return mergeFeedWindow(
    request.posts,
    feedEventsInDisplayBounds(incoming, {
      before: direction === 'older' ? request.cursor : undefined,
      after: direction === 'newer' ? request.cursor : undefined,
    }),
    feedWindowSize,
    direction === 'older' && request.preserve === 'older',
  );
}

function olderProfileFromCache(
  request: ProfileOlderRequest,
  page: {
    readonly items: FeedEvent[];
    readonly hasOlder: boolean;
    readonly nextCursor?: FeedCursorPoint;
  },
) {
  const window = profileWindow(request, page.items, 'older');
  return {
    posts: window.items,
    hasOlder: page.hasOlder,
    newerPruned: window.prunedNewer,
    nextOlderCursor: page.nextCursor,
  };
}

function newerProfileFromCache(
  request: ProfileOlderRequest,
  page: {
    readonly items: FeedEvent[];
    readonly hasNewer: boolean;
    readonly nextCursor?: FeedCursorPoint;
  },
) {
  const window = profileWindow(request, page.items, 'newer');
  return {
    posts: window.items,
    hasNewer: page.hasNewer,
    olderPruned: window.prunedOlder,
    nextNewerCursor: page.nextCursor,
  };
}
