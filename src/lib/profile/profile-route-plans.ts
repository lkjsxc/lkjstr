import { feedDisplayKinds } from '$lib/events/feed-kinds';
import type { RelayGroupPageResult } from '$lib/events/relay-page';
import { readRelayFeedGroups } from '$lib/events/relay-page';
import type { FeedCursorPoint } from '$lib/events/types';
import type { PoolEvent } from '$lib/relays/relay-pool';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import {
  pageIntentSemanticKey,
  resolvePagingRoutePurpose,
  routeGroupFingerprint,
} from '$lib/relays/orchestration/page-reads';
import { planPagingRouteGroups } from '$lib/relays/orchestration/route-plan';
import type { PageIntentDirection } from '$lib/relays/orchestration/intent-types';
import type { RelayRouteGroup } from '$lib/relays/relay-route-types';
import { profileLiveFilters } from './profile-subscription-filters';
import { profileContentGroups } from './profile-relays';

export type ProfilePostsPageRequest = {
  readonly pubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly direction: PageIntentDirection;
  readonly cursor?: FeedCursorPoint;
  readonly signal?: AbortSignal;
};

export async function readProfilePostsPageByIntent(
  request: ProfilePostsPageRequest,
): Promise<RelayGroupPageResult> {
  const groups = await profilePostRouteGroups(request.pubkey, request.relays);
  const routeFingerprint = routeGroupFingerprint(groups);
  return readRelayFeedGroups({
    key: pageIntentSemanticKey({
      surface: 'profile',
      owner: request.owner,
      phase: request.direction === 'initial' ? 'bootstrap' : 'page',
      selectedRelays: request.relays,
      authors: [request.pubkey],
      pageSize: request.pageSize,
      direction: request.direction,
      cursor: request.cursor,
      purpose: 'feed',
      routeFingerprint,
    }),
    groups,
    filters: (group, bounds) => [
      {
        kinds: feedDisplayKinds,
        authors: group.authors ?? [request.pubkey],
        ...bounds,
        limit: request.pageSize,
      },
    ],
    direction: request.direction,
    before: request.direction === 'older' ? request.cursor : undefined,
    after: request.direction === 'newer' ? request.cursor : undefined,
    pageSize: request.pageSize,
    subscriptions: request.subscriptions,
    signal: request.signal,
    purpose: 'feed',
  });
}

export async function submitProfilePostsLiveIntent(input: {
  readonly pubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly startedAt: number;
  readonly visibility: 'visible' | 'hidden';
  readonly subscriptions: SubscriptionOrchestrator;
  readonly onEvent: (event: PoolEvent) => void;
}): Promise<() => void> {
  const groups = await profilePostRouteGroups(input.pubkey, input.relays);
  return input.subscriptions.submitLiveIntent(
    {
      surface: 'profile',
      owner: input.owner,
      channel: 'profile:posts',
      visibility: input.visibility,
      selectedRelays: input.relays,
      filters: profileLiveFilters(
        input.pubkey,
        input.startedAt,
        input.pageSize,
      ),
      purpose: 'feed',
      since: input.startedAt,
    },
    [...new Set(groups.flatMap((group) => group.relays))],
    input.onEvent,
  );
}

async function profilePostRouteGroups(
  pubkey: string,
  relays: readonly string[],
) {
  const planned = await planPagingRouteGroups({
    authors: [pubkey],
    selectedRelays: relays,
    purpose: resolvePagingRoutePurpose({ surface: 'profile' }),
  });
  const contentGroups = profileContentGroups(planned);
  return contentGroups.length > 0
    ? contentGroups
    : selectedProfilePostGroups(pubkey, relays);
}

function selectedProfilePostGroups(
  pubkey: string,
  relays: readonly string[],
): RelayRouteGroup[] {
  return relays.length
    ? [
        {
          key: 'fallback:profile-content',
          relays,
          authors: [pubkey],
          source: 'fallback',
        },
      ]
    : [];
}
