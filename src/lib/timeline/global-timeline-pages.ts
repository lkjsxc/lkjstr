import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { feedDisplayKinds } from '../events/feed-kinds';
import { queryFeed, upsertEvent } from '../events/repository';
import { readRelayFeedGroups } from '../events/relay-page';
import type { FeedCursorPoint } from '../events/types';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import {
  initialRelaySubscriptionId,
  newerRelaySubscriptionId,
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
): Promise<GlobalPageResult> {
  const relayPage = await readRelayFeedGroups({
    key: initialRelaySubscriptionId(request.subId),
    groups: [{ key: 'selected', relays: request.relays, source: 'selected' }],
    filters: (_group, bounds) => [
      { kinds: feedDisplayKinds, ...bounds, limit: request.pageSize },
    ],
    direction: 'initial',
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
  });
  const relayItems = relayPage.receivedItems ?? relayPage.items;
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
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
  const relayPage = await readRelayFeedGroups({
    key: olderRelaySubscriptionId(request.subId, request.cursor),
    groups: [{ key: 'selected', relays: request.relays, source: 'selected' }],
    filters: (_group, bounds) => [
      { kinds: feedDisplayKinds, ...bounds, limit: request.pageSize },
    ],
    direction: 'older',
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
  });
  const relayItems = relayPage.receivedItems ?? relayPage.items;
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
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
  const relayPage = await readRelayFeedGroups({
    key: newerRelaySubscriptionId(request.subId, request.cursor),
    groups: [{ key: 'selected', relays: request.relays, source: 'selected' }],
    filters: (_group, bounds) => [
      { kinds: feedDisplayKinds, ...bounds, limit: request.pageSize },
    ],
    direction: 'newer',
    after: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    purpose: 'feed',
  });
  const relayItems = relayPage.receivedItems ?? relayPage.items;
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
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
