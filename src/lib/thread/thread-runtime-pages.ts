import { threadWindowSize } from '../events/feed-window';
import { lookupEvent, queryFeed } from '../events/repository';
import {
  boundaryUntil,
  readRelayFeedPage,
  readRelayPage,
} from '../events/relay-page';
import type { FeedCursorPoint } from '../events/types';
import { replyRoot } from '../protocol';
import { routedEventRelays } from '../relays/relay-routing';
import { pageIntentSemanticKey } from '../relays/orchestration/page-reads';
import {
  threadIntervalSince,
  toThreadItems,
  type ThreadPageRequest,
} from './thread-page-helpers';
import {
  mergeThreadItems,
  storeThreadEvent,
  type ThreadItem,
} from './thread-store';

export async function loadInitialThreadPage(request: ThreadPageRequest) {
  const cached = await lookupEvent(request.eventId);
  const relays = await routedEventRelays({
    selectedRelays: request.relays,
    hintedRelays: cached?.relays,
    authorPubkey: cached?.event.pubkey,
  });
  const focused = await readRelayPage({
    key: pageIntentSemanticKey({
      surface: 'thread',
      owner: request.owner,
      phase: 'bootstrap',
      selectedRelays: request.relays,
      authors: [],
      pageSize: 1,
      direction: 'initial',
      purpose: 'event-lookup',
      relayFilters: [{ ids: [request.eventId] }],
    }),
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
    key: pageIntentSemanticKey({
      surface: 'thread',
      owner: request.owner,
      phase: 'bootstrap',
      selectedRelays: relays,
      authors: [request.eventId, rootId],
      pageSize: request.pageSize,
      direction: 'initial',
      purpose: 'event-lookup',
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
  const all = [...toThreadItems(focused), ...relayEvents];
  await Promise.all(
    all.map((item) => storeThreadEvent(item.event, item.relays)),
  );
  return { rootId, items: all };
}

export async function loadOlderThreadPage(
  request: ThreadPageRequest & {
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
    key: pageIntentSemanticKey({
      surface: 'thread',
      owner: request.owner,
      phase: 'page',
      selectedRelays: relays,
      authors: [request.rootId, request.eventId],
      pageSize: request.pageSize,
      direction: 'older',
      cursor: request.cursor,
      purpose: 'feed',
    }),
    relays,
    filters: [
      {
        kinds: [1],
        '#e': [request.rootId, request.eventId],
        since: threadIntervalSince(request.cursor),
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
