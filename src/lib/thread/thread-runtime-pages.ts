import { threadWindowSize } from '../events/feed-window';
import { lookupEvent, queryFeed } from '../events/repository';
import {
  boundarySince,
  boundaryUntil,
  readRelayFeedPage,
  readRelayPage,
} from '../events/relay-page';
import type { FeedCursorPoint } from '../events/types';
import { replyRoot } from '../protocol';
import { routedEventRelays } from '../relays/relay-routing';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import {
  compactRelaySubscriptionId,
  initialRelaySubscriptionId,
  olderRelaySubscriptionId,
} from '../relays/subscription-id';
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
  readonly signal?: AbortSignal;
};

export async function loadInitialThreadPage(request: Request) {
  const cached = await lookupEvent(request.eventId);
  const relays = await routedEventRelays({
    selectedRelays: request.relays,
    hintedRelays: cached?.relays,
    authorPubkey: cached?.event.pubkey,
  });
  const focused = await readRelayPage({
    key: compactRelaySubscriptionId(request.subId, 'focus', request.eventId),
    relays,
    filters: [{ ids: [request.eventId] }],
    pageSize: 1,
    subscriptions: request.subscriptions,
    signal: request.signal,
    purpose: 'event-lookup',
  });
  const rootId = focused[0]?.event
    ? (replyRoot(focused[0].event) ?? request.eventId)
    : request.rootId;
  const relayEvents = await readRelayFeedPage({
    key: initialRelaySubscriptionId(request.subId, {
      eventId: request.eventId,
      rootId,
    }),
    relays,
    filters: [
      { ids: [request.eventId, rootId] },
      { kinds: [1], '#e': [rootId, request.eventId], limit: request.pageSize },
    ],
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    signal: request.signal,
    purpose: 'event-lookup',
  });
  const all = [...toItems(focused), ...relayEvents];
  await Promise.all(
    all.map((item) => storeThreadEvent(item.event, item.relays)),
  );
  return { rootId, items: all };
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
  const relays = await routedEventRelays({ selectedRelays: request.relays });
  const relayEvents = await readRelayFeedPage({
    key: olderRelaySubscriptionId(request.subId, request.cursor),
    relays,
    filters: [
      {
        kinds: [1],
        '#e': [request.rootId, request.eventId],
        since: intervalSince(request.cursor),
        until: boundaryUntil(request.cursor),
        limit: request.pageSize,
      },
    ],
    before: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    signal: request.signal,
    purpose: 'feed',
  });
  await Promise.all(
    relayEvents.map((item) => storeThreadEvent(item.event, item.relays)),
  );
  const items = mergeThreadItems(request.items, [
    ...page.items,
    ...relayEvents,
  ]);
  const pruned = items.length > threadWindowSize;
  return {
    items: pruned ? items.slice(-threadWindowSize) : items,
    hasOlder: page.hasMore || relayEvents.length >= request.pageSize,
    pruned,
  };
}

export async function loadNewerThreadPage(
  request: Request & {
    readonly items: readonly ThreadItem[];
    readonly cursor: FeedCursorPoint;
  },
) {
  const page = await queryFeed({
    kind: 'thread',
    eventId: request.rootId,
    after: request.cursor,
    limit: request.pageSize,
  });
  const relays = await routedEventRelays({ selectedRelays: request.relays });
  const relayEvents = await readRelayFeedPage({
    key: olderRelaySubscriptionId(request.subId, request.cursor),
    relays,
    filters: [
      {
        kinds: [1],
        '#e': [request.rootId, request.eventId],
        since: boundarySince(request.cursor),
        until: intervalUntil(request.cursor),
        limit: request.pageSize,
      },
    ],
    after: request.cursor,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    signal: request.signal,
    purpose: 'feed',
  });
  await Promise.all(
    relayEvents.map((item) => storeThreadEvent(item.event, item.relays)),
  );
  const items = mergeThreadItems(request.items, [
    ...page.items,
    ...relayEvents,
  ]);
  const pruned = items.length > threadWindowSize;
  return {
    items: pruned ? items.slice(0, threadWindowSize) : items,
    hasNewer: page.hasMore || relayEvents.length >= request.pageSize,
    pruned,
  };
}

function toItems(
  events: readonly { event: ThreadItem['event']; relay: string }[],
) {
  return events.map((item) => ({ event: item.event, relays: [item.relay] }));
}

function intervalSince(cursor: FeedCursorPoint): number {
  return Math.max(0, cursor.createdAt - 30 * 24 * 60 * 60);
}

function intervalUntil(cursor: FeedCursorPoint): number {
  return cursor.createdAt + 30 * 24 * 60 * 60;
}
