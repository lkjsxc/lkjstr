import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import { queryFeed, upsertEvent } from '../events/repository';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import { authorFilters } from './follow-list';
import type { TimelineItem } from './timeline-store';

export type TimelineOlderRequest = {
  readonly items: readonly TimelineItem[];
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly subId: string;
  readonly until: number;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
};

export type TimelineOlderResult = {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly newerPruned: boolean;
};

export async function loadOlderTimelinePage(
  request: TimelineOlderRequest,
): Promise<TimelineOlderResult> {
  const page = await queryFeed({
    kind: 'home',
    authors: request.authors,
    until: request.until,
    limit: request.pageSize,
  });
  const relayEvents =
    request.relays.length > 0
      ? await request.subscriptions.readPage({
          key: `${request.subId}:older:${request.until}`,
          relays: request.relays,
          filters: authorFilters(request.authors, request.pageSize, {
            until: request.until,
          }),
        })
      : [];
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
    newerPruned: window.newerPruned,
  };
}
