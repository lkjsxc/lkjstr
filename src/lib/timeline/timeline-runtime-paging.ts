import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { queryFeed, upsertEvent } from '../events/repository';
import { readRelayFeedGroups } from '../events/relay-page';
import { routeGroups } from '../relays/relay-routing';
import type { FeedCursorPoint } from '../events/types';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import {
  initialRelaySubscriptionId,
  newerRelaySubscriptionId,
  olderRelaySubscriptionId,
} from '../relays/subscription-id';
import { authorFilters } from './follow-list';
import type { TimelineItem } from './timeline-store';

export type TimelineOlderRequest = {
  readonly items: readonly TimelineItem[];
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly subId: string;
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
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
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly subId: string;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
};

export async function loadInitialTimelinePage(
  request: TimelineInitialRequest,
): Promise<TimelinePageResult> {
  const groups = await routeGroups({
    authors: request.authors,
    selectedRelays: request.relays,
    purpose: 'write',
  });
  const relayPage = await readRelayFeedGroups({
    key: initialRelaySubscriptionId(request.subId, [...request.authors].sort()),
    groups,
    filters: (group, bounds) =>
      authorFilters(
        group.authors ?? [],
        request.pageSize,
        bounds,
        'per-filter',
      ),
    direction: 'initial',
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
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
  const groups = await routeGroups({
    authors: request.authors,
    selectedRelays: request.relays,
    purpose: 'write',
  });
  const relayPage = await readRelayFeedGroups({
    key: olderRelaySubscriptionId(request.subId, request.cursor),
    groups,
    filters: (group, bounds) =>
      authorFilters(
        group.authors ?? [],
        request.pageSize,
        bounds,
        'per-filter',
      ),
    direction: 'older',
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
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
  const groups = await routeGroups({
    authors: request.authors,
    selectedRelays: request.relays,
    purpose: 'write',
  });
  const relayPage = await readRelayFeedGroups({
    key: newerRelaySubscriptionId(request.subId, request.cursor),
    groups,
    filters: (group, bounds) =>
      authorFilters(
        group.authors ?? [],
        request.pageSize,
        bounds,
        'per-filter',
      ),
    direction: 'newer',
    after: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
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
