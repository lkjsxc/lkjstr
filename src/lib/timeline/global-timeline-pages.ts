import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { feedDisplayKinds } from '../events/feed-kinds';
import { readCacheFirstFeedPage } from '../events/feed-page-cache-first';
import { queryFeed, upsertEvent } from '../events/repository';
import {
  planTimelinePageIntent,
  readPlannedTimelinePage,
} from '../relays/orchestration/page-reads';
import type { FeedCursorPoint } from '../events/types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { PageIntent } from '../relays/orchestration/intent-types';
import type { PlannedTimelinePageIntent } from '../relays/orchestration/page-reads';
import type { OnProgressiveReadSnapshot } from '../relays/progressive-read-types';
import type { TimelineItem } from './timeline-store';

type Request = {
  readonly owner: string;
  readonly items: readonly TimelineItem[];
  readonly relays: readonly string[];
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
};

export async function loadInitialGlobalPage(
  request: Omit<Request, 'items'>,
): Promise<GlobalPageResult> {
  const plan = await planTimelinePageIntent(globalIntent(request, 'initial'));
  const cache = await readCacheFirstFeedPage({
    plan,
    subscriptions: request.subscriptions,
  });
  if (cache.kind === 'complete-cache') return pageFromCache(cache.page);
  if (cache.kind === 'partial-cache') {
    void readAndStore(request, plan).catch(() => undefined);
    return pageFromCache(cache.page);
  }
  return pageFromRelay(await readAndStore(request, plan));
}

export async function loadOlderGlobalPage(
  request: Request & { readonly cursor: FeedCursorPoint },
) {
  const page = await queryFeed({
    kind: 'global',
    relays: request.relays,
    before: request.cursor,
    limit: request.pageSize,
  });
  const plan = await planTimelinePageIntent(globalIntent(request, 'older'));
  const cache = await readCacheFirstFeedPage({
    plan,
    subscriptions: request.subscriptions,
  });
  if (cache.kind !== 'miss') {
    if (cache.kind === 'partial-cache')
      void readAndStore(request, plan).catch(() => undefined);
    const window = mergeFeedWindow(
      request.items,
      cache.page.items,
      feedWindowSize,
      true,
    );
    return {
      items: window.items,
      hasOlder: cache.page.hasOlder,
      hasNewer: window.prunedNewer,
      nextOlderCursor: cache.page.nextCursor,
    };
  }
  const relayPage = await readAndStore(request, plan);
  const older = [...page.items, ...relayPage.items];
  const window = mergeFeedWindow(request.items, older, feedWindowSize, true);
  return {
    items: window.items,
    hasOlder: page.hasMore || relayPage.hasMorePossible,
    hasNewer: window.prunedNewer,
    nextOlderCursor: relayPage.nextCursor,
    incomplete: relayPage.incomplete,
  };
}

export async function loadNewerGlobalPage(
  request: Request & { readonly cursor: FeedCursorPoint },
) {
  const page = await queryFeed({
    kind: 'global',
    relays: request.relays,
    after: request.cursor,
    limit: request.pageSize,
  });
  const plan = await planTimelinePageIntent(globalIntent(request, 'newer'));
  const cache = await readCacheFirstFeedPage({
    plan,
    subscriptions: request.subscriptions,
  });
  if (cache.kind !== 'miss') {
    if (cache.kind === 'partial-cache')
      void readAndStore(request, plan).catch(() => undefined);
    const window = mergeFeedWindow(
      request.items,
      cache.page.items,
      feedWindowSize,
    );
    return {
      items: window.items,
      hasNewer: cache.page.hasNewer,
      hasOlder: window.prunedOlder,
      nextNewerCursor: cache.page.nextCursor,
    };
  }
  const relayPage = await readAndStore(request, plan);
  const window = mergeFeedWindow(
    request.items,
    [...page.items, ...relayPage.items],
    feedWindowSize,
  );
  return {
    items: window.items,
    hasNewer: page.hasMore || relayPage.hasMorePossible,
    hasOlder: window.prunedOlder,
    nextNewerCursor: relayPage.nextCursor,
    incomplete: relayPage.incomplete,
  };
}

export type GlobalPageResult = {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly hasNewer?: boolean;
  readonly nextOlderCursor?: FeedCursorPoint;
  readonly incomplete?: boolean;
};

function globalIntent(
  request:
    | Omit<Request, 'items'>
    | (Request & { readonly cursor: FeedCursorPoint }),
  direction: PageIntent['direction'],
): PageIntent {
  return {
    surface: 'global',
    owner: request.owner,
    phase: direction === 'initial' ? 'bootstrap' : 'page',
    selectedRelays: request.relays,
    authors: [],
    pageSize: request.pageSize,
    direction,
    cursor: 'cursor' in request ? request.cursor : undefined,
    filters: (_group, bounds) => [
      { kinds: feedDisplayKinds, ...bounds, limit: request.pageSize },
    ],
  };
}

async function readAndStore(
  request: Omit<Request, 'items'>,
  plan: PlannedTimelinePageIntent,
) {
  const page = await readPlannedTimelinePage(request.subscriptions, plan, {
    signal: request.signal,
    onSnapshot: request.onSnapshot,
  });
  await Promise.all(
    page.items.map((item) => upsertEvent(item.event, item.relays)),
  );
  return page;
}

function pageFromRelay(
  page: Awaited<ReturnType<typeof readAndStore>>,
): GlobalPageResult {
  return {
    items: page.items,
    hasOlder: page.hasMorePossible,
    nextOlderCursor: page.nextCursor,
    incomplete: page.incomplete,
  };
}

function pageFromCache(page: {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly nextCursor?: FeedCursorPoint;
}): GlobalPageResult {
  return {
    items: page.items,
    hasOlder: page.hasOlder,
    nextOlderCursor: page.nextCursor,
  };
}
