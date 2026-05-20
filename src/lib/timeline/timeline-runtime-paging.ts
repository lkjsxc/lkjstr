import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { queryFeed, upsertEvent } from '../events/repository';
import { boundaryUntil, readRelayPage } from '../events/relay-page';
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
  const relayEvents = await readRelayPage({
    key: initialRelaySubscriptionId(request.subId, [...request.authors].sort()),
    relays: request.relays,
    filters: authorFilters(request.authors, request.pageSize),
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
  });
  await Promise.all(
    relayEvents.map((item) => upsertEvent(item.event, [item.relay])),
  );
  return relayEvents.map((item) => ({
    event: item.event,
    relays: [item.relay],
  }));
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
  const relayEvents = await readRelayPage({
    key: olderRelaySubscriptionId(request.subId, request.cursor),
    relays: request.relays,
    filters: authorFilters(request.authors, request.pageSize, {
      until: boundaryUntil(request.cursor),
    }),
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
  });
  await Promise.all(
    relayEvents.map((item) => upsertEvent(item.event, [item.relay])),
  );
  const window = mergeFeedWindow(
    request.items,
    [
      ...page.items,
      ...relayEvents.map((item) => ({
        event: item.event,
        relays: [item.relay],
      })),
    ],
    feedWindowSize,
    true,
  );
  return {
    items: window.items,
    hasOlder: page.hasMore || relayEvents.length >= request.pageSize,
    hasNewer: window.prunedNewer,
  };
}
