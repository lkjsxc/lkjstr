import { threadWindowSize } from '../events/feed-window';
import { queryFeed } from '../events/repository';
import { boundarySince, readRelayFeedPage } from '../events/relay-page';
import type { FeedCursorPoint } from '../events/types';
import { routedEventRelays } from '../relays/relay-routing';
import { pageIntentSemanticKey } from '../relays/orchestration/page-reads';
import {
  threadIntervalUntil,
  type ThreadPageRequest,
} from './thread-page-helpers';
import {
  mergeThreadItems,
  storeThreadEvent,
  type ThreadItem,
} from './thread-store';

export async function loadNewerThreadPage(
  request: ThreadPageRequest & {
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
    key: pageIntentSemanticKey({
      surface: 'thread',
      owner: request.owner,
      phase: 'page',
      selectedRelays: relays,
      authors: [request.rootId, request.eventId],
      pageSize: request.pageSize,
      direction: 'newer',
      cursor: request.cursor,
      purpose: 'feed',
    }),
    relays,
    filters: [
      {
        kinds: [1],
        '#e': [request.rootId, request.eventId],
        since: boundarySince(request.cursor),
        until: threadIntervalUntil(request.cursor),
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
