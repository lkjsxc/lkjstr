import { readRelayFeedGroups } from '../../events/relay-page';
import type { RelayGroupPageResult } from '../../events/relay-page';
import { planPagingRouteGroups } from './route-plan';
import type { PageIntent } from './intent-types';
import type { RelayRoutePurpose } from '../relay-route-types';
import type {
  PageReadExecutor,
  SubscriptionOrchestrator,
} from './orchestrator-types';
import type { ReadPageOptions } from '../subscription-manager-types';
import type { ReadPageResult } from '../read-page-status';
import { pageIntentSubscriptionDescriptor } from '../subscription-descriptor';
import {
  pageIntentBounds,
  pageIntentScanKey,
  pageIntentSemanticKey,
  routeGroupFingerprint,
} from './page-read-keys';

export {
  pageIntentBounds,
  pageIntentScanKey,
  pageIntentSemanticKey,
  routeGroupFingerprint,
} from './page-read-keys';

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
  groups: Parameters<typeof routeGroupFingerprint>[0],
): PageIntent {
  return {
    ...intent,
    routeFingerprint: routeGroupFingerprint(groups),
  };
}

export type PlannedTimelinePageIntent = {
  readonly intent: PageIntent;
  readonly groups: Parameters<typeof routeGroupFingerprint>[0];
  readonly key: string;
};

export async function planTimelinePageIntent(
  intent: PageIntent,
): Promise<PlannedTimelinePageIntent> {
  const groups = await planPagingRouteGroups({
    authors: intent.authors,
    selectedRelays: intent.selectedRelays,
    purpose: resolvePagingRoutePurpose(intent),
  });
  const planned = plannedPageIntent(intent, groups);
  return { intent: planned, groups, key: pageIntentSemanticKey(planned) };
}

export async function readTimelinePageByIntent(
  orchestrator: SubscriptionOrchestrator,
  intent: PageIntent,
  options: ReadPageOptions = {},
): Promise<RelayGroupPageResult> {
  return readPlannedTimelinePage(
    orchestrator,
    await planTimelinePageIntent(intent),
    options,
  );
}

export function readPlannedTimelinePage(
  orchestrator: SubscriptionOrchestrator,
  plan: PlannedTimelinePageIntent,
  options: ReadPageOptions = {},
): Promise<RelayGroupPageResult> {
  const filters = plan.intent.filters;
  if (!filters)
    throw new Error('PageIntent.filters required for timeline paging');
  return readRelayFeedGroups({
    key: plan.key,
    semanticFeedKey: pageIntentScanKey(plan.intent),
    groups: plan.groups,
    filters,
    direction: plan.intent.direction,
    routeFingerprint: plan.intent.routeFingerprint,
    ...pageIntentBounds(plan.intent),
    pageSize: plan.intent.pageSize,
    maxSegments: plan.intent.maxSegments,
    subscriptions: orchestrator,
    purpose: plan.intent.purpose ?? 'feed',
    signal: options.signal,
    onSnapshot: options.onSnapshot,
  });
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
