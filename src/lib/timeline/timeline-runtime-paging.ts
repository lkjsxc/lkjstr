import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { queryFeed, upsertEvent } from '../events/repository';
import { readRelayFeedGroups, readRelayFeedPage } from '../events/relay-page';
import { routeGroups } from '../relays/relay-routing';
import type { FeedCursorPoint } from '../events/types';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import {
  initialRelaySubscriptionId,
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
): Promise<TimelineItem[]> {
  const relayItems = await readRelayFeedPage({
    key: initialRelaySubscriptionId(request.subId, [...request.authors].sort()),
    relays: request.relays,
    filters: authorFilters(request.authors, request.pageSize),
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
  });
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
  );
  return relayItems;
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
      authorFilters(group.authors ?? [], request.pageSize, bounds),
    direction: 'older',
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
  });
  const relayItems = relayPage.items;
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
  );
  const window = mergeFeedWindow(
    request.items,
    [...page.items, ...relayItems],
    feedWindowSize,
    true,
  );
  return {
    items: window.items,
    hasOlder: page.hasMore || relayPage.hasMorePossible,
    hasNewer: window.prunedNewer,
  };
}
