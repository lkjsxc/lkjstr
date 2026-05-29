import { readRelayFeedGroups } from '../../events/relay-page';
import type { RelayGroupPageResult } from '../../events/relay-page';
import { planPagingRouteGroups } from './route-plan';
import type { PageIntent } from './intent-types';
import type { FeedCursorPoint } from '../../events/types';
import type { RelayRouteGroup } from '../relay-route-types';
import type { RelayRoutePurpose } from '../relay-route-types';
import type {
  PageReadExecutor,
  SubscriptionOrchestrator,
} from './orchestrator-types';
import type { ReadPageOptions } from '../subscription-manager-types';
import type { ReadPageResult } from '../read-page-status';
import { pageIntentSubscriptionDescriptor } from '../subscription-descriptor';

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
  const filters = relayFilterKey(intent.relayFilters ?? []);
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
    filters,
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
  const records = groups
    .map((group) => [
      group.key,
      [...group.relays].sort(),
      [...(group.authors ?? [])].sort(),
      group.source,
    ])
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  return JSON.stringify(records);
}

export function resolvePagingRoutePurpose(
  intent: Pick<PageIntent, 'surface'>,
): RelayRoutePurpose {
  if (intent.surface === 'home' || intent.surface === 'profile') {
    return 'write';
  }
  return 'both';
}

export function plannedPageIntent(
  intent: PageIntent,
  groups: readonly RelayRouteGroup[],
): PageIntent {
  return {
    ...intent,
    routeFingerprint: routeGroupFingerprint(groups),
  };
}

export async function readTimelinePageByIntent(
  orchestrator: SubscriptionOrchestrator,
  intent: PageIntent,
  options: ReadPageOptions = {},
): Promise<RelayGroupPageResult> {
  const groups = await planPagingRouteGroups({
    authors: intent.authors,
    selectedRelays: intent.selectedRelays,
    purpose: resolvePagingRoutePurpose(intent),
  });
  const planned = plannedPageIntent(intent, groups);
  const key = pageIntentSemanticKey(planned);
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
    signal: options.signal,
    onSnapshot: options.onSnapshot,
  });
}

function cursorKey(cursor: FeedCursorPoint | undefined): string {
  return cursor ? `${cursor.createdAt}:${cursor.id}` : '';
}

function relayFilterKey(
  filters: NonNullable<PageIntent['relayFilters']>,
): string {
  return JSON.stringify(filters.map(normalizeFilter));
}

function normalizeFilter(
  filter: NonNullable<PageIntent['relayFilters']>[number],
): Record<string, unknown> {
  const entries: [string, unknown][] = Object.entries(filter).map(
    ([key, value]) => [key, normalizeFilterValue(value)],
  );
  return Object.fromEntries(
    entries.sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeFilterValue(value: unknown): unknown {
  return Array.isArray(value) ? [...value].sort() : value;
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
      descriptor: pageIntentSubscriptionDescriptor(intent),
    },
    options,
  );
}
