import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { readCacheFirstFeedPage } from '../events/feed-page-cache-first';
import { queryFeed, upsertEvent } from '../events/repository';
import type { FeedCursorPoint } from '../events/types';
import type { DemandSurface } from '../relays/orchestration/demand-types';
import type { PageIntent } from '../relays/orchestration/intent-types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import {
  planTimelinePageIntent,
  readPlannedTimelinePage,
} from '../relays/orchestration/page-reads';
import type { PlannedTimelinePageIntent } from '../relays/orchestration/page-reads';
import type { RelayGroupPageResult } from '../events/relay-page';
import type { OnProgressiveReadSnapshot } from '../relays/progressive-read-types';
import { authorFilters } from './follow-list';
import {
  initialTimelineFromCache,
  newerTimelineFromCache,
  olderTimelineFromCache,
} from './timeline-cache-results';
import type { TimelineItem } from './timeline-store';

export type TimelineOlderRequest = {
  readonly surface: DemandSurface;
  readonly owner: string;
  readonly items: readonly TimelineItem[];
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
};

export type TimelineOlderResult = {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly hasNewer: boolean;
  readonly nextOlderCursor?: FeedCursorPoint;
  readonly incomplete?: boolean;
};

export type TimelineNewerResult = {
  readonly items: TimelineItem[];
  readonly hasNewer: boolean;
  readonly hasOlder: boolean;
  readonly nextNewerCursor?: FeedCursorPoint;
  readonly incomplete?: boolean;
};

export type TimelineInitialRequest = {
  readonly surface: DemandSurface;
  readonly owner: string;
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
};

export async function loadInitialTimelinePage(
  request: TimelineInitialRequest,
): Promise<TimelinePageResult> {
  const plan = await planTimelinePageIntent(timelineIntent(request, 'initial'));
  const cache = await readCacheFirstFeedPage({
    plan,
    subscriptions: request.subscriptions,
  });
  if (cache.kind === 'complete-cache') return initialTimelineFromCache(cache.page);
  if (cache.kind === 'partial-cache') {
    void readAndStoreRelayPage(request, plan).catch(() => undefined);
    return initialTimelineFromCache(cache.page);
  }
  return initialFromRelay(await readAndStoreRelayPage(request, plan));
}

export async function loadOlderTimelinePage(
  request: TimelineOlderRequest,
): Promise<TimelineOlderResult> {
  const plan = await planTimelinePageIntent(timelineIntent(request, 'older'));
  const cache = await readCacheFirstFeedPage({
    plan,
    subscriptions: request.subscriptions,
  });
  if (cache.kind !== 'miss') {
    if (cache.kind === 'partial-cache')
      void readAndStoreRelayPage(request, plan).catch(() => undefined);
    return olderTimelineFromCache(request, cache.page);
  }
  const [page, relayPage] = await Promise.all([
    localTimelinePage(request, 'older'),
    readAndStoreRelayPage(request, plan),
  ]);
  const window = mergeFeedWindow(
    request.items,
    [...page.items, ...relayPage.items],
    feedWindowSize,
    true,
  );
  return {
    items: window.items,
    hasOlder: page.hasMore || relayPage.hasMorePossible,
    hasNewer: window.prunedNewer,
    nextOlderCursor: relayPage.nextCursor,
    incomplete: relayPage.incomplete,
  };
}

export async function loadNewerTimelinePage(
  request: TimelineOlderRequest,
): Promise<TimelineNewerResult> {
  const plan = await planTimelinePageIntent(timelineIntent(request, 'newer'));
  const cache = await readCacheFirstFeedPage({
    plan,
    subscriptions: request.subscriptions,
  });
  if (cache.kind !== 'miss') {
    if (cache.kind === 'partial-cache')
      void readAndStoreRelayPage(request, plan).catch(() => undefined);
    return newerTimelineFromCache(request, cache.page);
  }
  const [page, relayPage] = await Promise.all([
    localTimelinePage(request, 'newer'),
    readAndStoreRelayPage(request, plan),
  ]);
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

export type TimelinePageResult = {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly nextOlderCursor?: FeedCursorPoint;
  readonly incomplete?: boolean;
};

function timelineIntent(
  request: TimelineInitialRequest | TimelineOlderRequest,
  direction: PageIntent['direction'],
): PageIntent {
  return {
    surface: request.surface,
    owner: request.owner,
    phase: direction === 'initial' ? 'bootstrap' : 'page',
    selectedRelays: request.relays,
    authors: [...request.authors],
    pageSize: request.pageSize,
    direction,
    cursor: 'cursor' in request ? request.cursor : undefined,
    filters: (group, bounds) =>
      authorFilters(group.authors ?? [], request.pageSize, bounds, homeBudgetMode(request.surface)),
  };
}

async function readAndStoreRelayPage(
  request: TimelineInitialRequest | TimelineOlderRequest,
  plan: PlannedTimelinePageIntent,
): Promise<RelayGroupPageResult> {
  const page = await readPlannedTimelinePage(request.subscriptions, plan, {
    signal: request.signal,
    onSnapshot: request.onSnapshot,
  });
  await Promise.all(page.items.map((item) => upsertEvent(item.event, item.relays)));
  return page;
}

function localTimelinePage(request: TimelineOlderRequest, direction: 'older' | 'newer') {
  return queryFeed({
    kind: 'home',
    authors: request.authors,
    before: direction === 'older' ? request.cursor : undefined,
    after: direction === 'newer' ? request.cursor : undefined,
    limit: request.pageSize,
  });
}

function initialFromRelay(relayPage: RelayGroupPageResult): TimelinePageResult {
  return {
    items: relayPage.items,
    hasOlder: relayPage.hasMorePossible,
    nextOlderCursor: relayPage.nextCursor,
    incomplete: relayPage.incomplete,
  };
}

function homeBudgetMode(surface: DemandSurface) {
  return surface === 'home' ? 'shared-budget' : 'per-filter';
}
