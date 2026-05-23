import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { feedDisplayKinds } from '../events/feed-kinds';
import { queryFeed, upsertEvent } from '../events/repository';
import { boundaryUntil, readRelayFeedPage } from '../events/relay-page';
import type { FeedCursorPoint } from '../events/types';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import {
  initialRelaySubscriptionId,
  olderRelaySubscriptionId,
} from '../relays/subscription-id';
import type { TimelineItem } from './timeline-store';

type Request = {
  readonly items: readonly TimelineItem[];
  readonly relays: readonly string[];
  readonly subId: string;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
};

export async function loadInitialGlobalPage(
  request: Omit<Request, 'items'>,
): Promise<TimelineItem[]> {
  const relayItems = await readRelayFeedPage({
    key: initialRelaySubscriptionId(request.subId),
    relays: request.relays,
    filters: [{ kinds: feedDisplayKinds, limit: request.pageSize }],
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
  });
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
  );
  return relayItems;
}

export async function loadOlderGlobalPage(
  request: Request & { readonly cursor: FeedCursorPoint },
) {
  const page = await queryFeed({
    kind: 'global',
    before: request.cursor,
    limit: request.pageSize,
  });
  const relayItems = await readRelayFeedPage({
    key: olderRelaySubscriptionId(request.subId, request.cursor),
    relays: request.relays,
    filters: [
      {
        kinds: feedDisplayKinds,
        until: boundaryUntil(request.cursor),
        limit: request.pageSize,
      },
    ],
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
  });
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
  );
  const older = [...page.items, ...relayItems];
  const window = mergeFeedWindow(request.items, older, feedWindowSize, true);
  return {
    items: window.items,
    hasOlder: page.hasMore || relayItems.length >= request.pageSize,
    hasNewer: window.prunedNewer,
  };
}
