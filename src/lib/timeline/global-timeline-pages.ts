import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { feedDisplayKinds } from '../events/feed-kinds';
import { queryFeed, upsertEvent } from '../events/repository';
import { readTimelinePageByIntent } from '../relays/orchestration/page-reads';
import type { FeedCursorPoint } from '../events/types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { TimelineItem } from './timeline-store';

type Request = {
  readonly owner: string;
  readonly items: readonly TimelineItem[];
  readonly relays: readonly string[];
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
};

export async function loadInitialGlobalPage(
  request: Omit<Request, 'items'>,
): Promise<GlobalPageResult> {
  const relayPage = await readTimelinePageByIntent(request.subscriptions, {
    surface: 'global',
    owner: request.owner,
    phase: 'bootstrap',
    selectedRelays: request.relays,
    authors: [],
    pageSize: request.pageSize,
    direction: 'initial',
    filters: (_group, bounds) => [
      { kinds: feedDisplayKinds, ...bounds, limit: request.pageSize },
    ],
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

export async function loadOlderGlobalPage(
  request: Request & { readonly cursor: FeedCursorPoint },
) {
  const page = await queryFeed({
    kind: 'global',
    before: request.cursor,
    limit: request.pageSize,
  });
  const relayPage = await readTimelinePageByIntent(request.subscriptions, {
    surface: 'global',
    owner: request.owner,
    phase: 'page',
    selectedRelays: request.relays,
    authors: [],
    pageSize: request.pageSize,
    direction: 'older',
    cursor: request.cursor,
    filters: (_group, bounds) => [
      { kinds: feedDisplayKinds, ...bounds, limit: request.pageSize },
    ],
  });
  await Promise.all(
    relayPage.items.map((item) => upsertEvent(item.event, item.relays)),
  );
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
    after: request.cursor,
    limit: request.pageSize,
  });
  const relayPage = await readTimelinePageByIntent(request.subscriptions, {
    surface: 'global',
    owner: request.owner,
    phase: 'page',
    selectedRelays: request.relays,
    authors: [],
    pageSize: request.pageSize,
    direction: 'newer',
    cursor: request.cursor,
    filters: (_group, bounds) => [
      { kinds: feedDisplayKinds, ...bounds, limit: request.pageSize },
    ],
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

export type GlobalPageResult = {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly hasNewer?: boolean;
  readonly nextOlderCursor?: FeedCursorPoint;
  readonly incomplete?: boolean;
};
