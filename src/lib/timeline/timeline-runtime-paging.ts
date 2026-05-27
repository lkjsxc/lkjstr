import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { queryFeed, upsertEvent } from '../events/repository';
import type { FeedCursorPoint } from '../events/types';
import type { DemandSurface } from '../relays/orchestration/demand-types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { readTimelinePageByIntent } from '../relays/orchestration/page-reads';
import { authorFilters } from './follow-list';
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
};

export async function loadInitialTimelinePage(
  request: TimelineInitialRequest,
): Promise<TimelinePageResult> {
  const relayPage = await readTimelinePageByIntent(request.subscriptions, {
    surface: request.surface,
    owner: request.owner,
    phase: 'bootstrap',
    selectedRelays: request.relays,
    authors: [...request.authors],
    pageSize: request.pageSize,
    direction: 'initial',
    filters: (group, bounds) =>
      authorFilters(
        group.authors ?? [],
        request.pageSize,
        bounds,
        homeBudgetMode(request.surface),
      ),
  });
  await Promise.all(
    relayPage.items.map((item) => upsertEvent(item.event, item.relays)),
  );
  return {
    items: relayPage.items,
    hasOlder: relayPage.hasMorePossible,
    nextOlderCursor: relayPage.nextCursor,
    incomplete: relayPage.incomplete,
  };
}

export async function loadOlderTimelinePage(
  request: TimelineOlderRequest,
): Promise<TimelineOlderResult> {
  const page = await queryFeed({
    kind: 'home',
    authors: request.authors,
    before: request.cursor,
    limit: request.pageSize,
  });
  const relayPage = await readTimelinePageByIntent(request.subscriptions, {
    surface: request.surface,
    owner: request.owner,
    phase: 'page',
    selectedRelays: request.relays,
    authors: [...request.authors],
    pageSize: request.pageSize,
    direction: 'older',
    cursor: request.cursor,
    filters: (group, bounds) =>
      authorFilters(
        group.authors ?? [],
        request.pageSize,
        bounds,
        homeBudgetMode(request.surface),
      ),
  });
  await Promise.all(
    relayPage.items.map((item) => upsertEvent(item.event, item.relays)),
  );
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
  const page = await queryFeed({
    kind: 'home',
    authors: request.authors,
    after: request.cursor,
    limit: request.pageSize,
  });
  const relayPage = await readTimelinePageByIntent(request.subscriptions, {
    surface: request.surface,
    owner: request.owner,
    phase: 'page',
    selectedRelays: request.relays,
    authors: [...request.authors],
    pageSize: request.pageSize,
    direction: 'newer',
    cursor: request.cursor,
    filters: (group, bounds) =>
      authorFilters(
        group.authors ?? [],
        request.pageSize,
        bounds,
        homeBudgetMode(request.surface),
      ),
  });
  await Promise.all(
    relayPage.items.map((item) => upsertEvent(item.event, item.relays)),
  );
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

function homeBudgetMode(surface: DemandSurface) {
  return surface === 'home' ? 'shared-budget' : 'per-filter';
}
