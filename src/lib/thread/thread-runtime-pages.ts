import { threadWindowSize } from '../events/feed-window';
import { queryFeed } from '../events/repository';
import { boundaryUntil, readRelayPage } from '../events/relay-page';
import type { FeedCursorPoint } from '../events/types';
import { replyRoot } from '../protocol';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import {
  mergeThreadItems,
  storeThreadEvent,
  type ThreadItem,
} from './thread-store';

type Request = {
  readonly eventId: string;
  readonly rootId: string;
  readonly relays: readonly string[];
  readonly subId: string;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
};

export async function loadInitialThreadPage(request: Request) {
  const focused = await readRelayPage({
    key: `${request.subId}:initial:focus`,
    relays: request.relays,
    filters: [{ ids: [request.eventId] }],
    pageSize: 1,
    subscriptions: request.subscriptions,
  });
  const rootId = focused[0]?.event
    ? (replyRoot(focused[0].event) ?? request.eventId)
    : request.rootId;
  const relayEvents = await readRelayPage({
    key: `${request.subId}:initial`,
    relays: request.relays,
    filters: [
      { ids: [request.eventId, rootId] },
      { kinds: [1], '#e': [rootId, request.eventId], limit: request.pageSize },
    ],
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
  });
  const all = [...focused, ...relayEvents];
  await Promise.all(
    all.map((item) => storeThreadEvent(item.event, [item.relay])),
  );
  return { rootId, items: toItems(all) };
}

export async function loadOlderThreadPage(
  request: Request & {
    readonly items: readonly ThreadItem[];
    readonly cursor: FeedCursorPoint;
  },
) {
  const page = await queryFeed({
    kind: 'thread',
    eventId: request.rootId,
    before: request.cursor,
    limit: request.pageSize,
  });
  const relayEvents = await readRelayPage({
    key: `${request.subId}:older:${request.cursor.createdAt}:${request.cursor.id}`,
    relays: request.relays,
    filters: [
      {
        kinds: [1],
        '#e': [request.rootId, request.eventId],
        until: boundaryUntil(request.cursor),
        limit: request.pageSize,
      },
    ],
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
  });
  await Promise.all(
    relayEvents.map((item) => storeThreadEvent(item.event, [item.relay])),
  );
  const items = mergeThreadItems(request.items, [
    ...page.items,
    ...toItems(relayEvents),
  ]);
  const pruned = items.length > threadWindowSize;
  return {
    items: pruned ? items.slice(-threadWindowSize) : items,
    hasOlder: page.hasMore || relayEvents.length >= request.pageSize,
    pruned,
  };
}

function toItems(
  events: readonly { event: ThreadItem['event']; relay: string }[],
) {
  return events.map((item) => ({ event: item.event, relays: [item.relay] }));
}
