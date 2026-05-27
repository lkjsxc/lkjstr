import { readRelayFeedGroups } from '../../events/relay-page';
import type { RelayGroupPageResult } from '../../events/relay-page';
import { planPagingRouteGroups } from './route-plan';
import type { PageIntent } from './intent-types';
import type { FeedCursorPoint } from '../../events/types';
import type { RelayRouteGroup } from '../relay-route-types';
import type {
  PageReadExecutor,
  SubscriptionOrchestrator,
} from './orchestrator-types';
import type { ReadPageOptions } from '../subscription-manager-types';
import type { ReadPageResult } from '../read-page-status';

function hashSemanticKey(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).padStart(8, '0').slice(0, 8);
}

export function pageIntentSemanticKey(intent: PageIntent): string {
  const bounds = pageIntentBounds(intent);
  const authors = [...intent.authors].sort().join(',');
  const before = cursorKey(bounds.before);
  const after = cursorKey(bounds.after);
  const relayKey = [...intent.selectedRelays].sort().join('\u0000');
  const raw = [
    intent.surface,
    intent.phase,
    intent.direction,
    authors,
    String(intent.pageSize),
    before,
    after,
    relayKey,
    intent.routeFingerprint ?? '',
    intent.purpose ?? 'feed',
  ].join('|');
  return `page:${hashSemanticKey(raw)}`;
}

export function pageIntentBounds(intent: PageIntent): {
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
} {
  if (intent.before || intent.after)
    return { before: intent.before, after: intent.after };
  if (intent.direction === 'older') return { before: intent.cursor };
  if (intent.direction === 'newer') return { after: intent.cursor };
  return {};
}

export function routeGroupFingerprint(
  groups: readonly RelayRouteGroup[],
): string {
  return groups
    .map((group) =>
      [
        group.key,
        [...group.relays].sort().join(','),
        [...(group.authors ?? [])].sort().join(','),
        group.source,
      ].join(':'),
    )
    .sort()
    .join('|');
}

export async function readTimelinePageByIntent(
  orchestrator: SubscriptionOrchestrator,
  intent: PageIntent,
): Promise<RelayGroupPageResult> {
  const groups = await planPagingRouteGroups({
    authors: intent.authors,
    selectedRelays: intent.selectedRelays,
    purpose: 'write',
  });
  const key = pageIntentSemanticKey({
    ...intent,
    routeFingerprint: routeGroupFingerprint(groups),
  });
  const filters = intent.filters;
  if (!filters) {
    throw new Error('PageIntent.filters required for timeline paging');
  }
  return readRelayFeedGroups({
    key,
    groups,
    filters,
    direction: intent.direction,
    ...pageIntentBounds(intent),
    pageSize: intent.pageSize,
    subscriptions: orchestrator,
    purpose: intent.purpose ?? 'feed',
  });
}

function cursorKey(cursor: FeedCursorPoint | undefined): string {
  return cursor ? `${cursor.createdAt}:${cursor.id}` : '';
}

export function readPageByIntent(
  orchestrator: PageReadExecutor,
  intent: PageIntent,
  options: ReadPageOptions = {},
): Promise<ReadPageResult> {
  return orchestrator.readPageDetailed(
    {
      key: pageIntentSemanticKey(intent),
      relays: intent.selectedRelays,
      filters: intent.relayFilters ?? [],
      purpose: intent.purpose ?? 'feed',
    },
    options,
  );
}
