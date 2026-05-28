import { feedWindowSize } from '../events/feed-window';
import {
  discoverRoutesForAuthors,
  planPagingRouteGroups,
} from '../relays/orchestration/route-plan';
import { routeGroupFingerprint } from '../relays/orchestration/page-reads';
import { readyWithEventsState } from './timeline-state';
import { mergeTimelineItems } from './timeline-store';
import { loadInitialTimelinePage } from './timeline-runtime-paging';
import type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export async function refreshTimelineRoutesAfterInitialPage(
  ctx: TimelineNetworkCtx,
): Promise<void> {
  const run = ctx.getGeneration();
  if (ctx.isClosed()) return;
  const before = await routeFingerprint(ctx);
  await discoverRoutesForAuthors({
    authors: ctx.getAuthors(),
    selectedRelays: ctx.relays,
    key: `home:routes:${[...ctx.getAuthors()].sort().join(',')}`,
    subscriptions: ctx.subscriptions,
    signal: ctx.signal,
  }).catch(() => undefined);
  if (!ctx.isActive(run)) return;
  const after = await routeFingerprint(ctx);
  if (before === after) return;
  const page = await loadInitialTimelinePage({
    surface: ctx.surface,
    owner: ctx.owner,
    authors: ctx.getAuthors(),
    relays: ctx.relays,
    pageSize: ctx.pageSize,
    subscriptions: ctx.subscriptions,
    signal: ctx.signal,
  }).catch(() => undefined);
  if (!page || !ctx.isActive(run) || page.items.length === 0) return;
  ctx.setCached(mergeTimelineItems(page.items, ctx.items(), feedWindowSize));
  ctx.clearLive();
  ctx.emit(ctx.nextState(readyWithEventsState(ctx.getState(), ctx.items())));
}

async function routeFingerprint(ctx: TimelineNetworkCtx): Promise<string> {
  return routeGroupFingerprint(
    await planPagingRouteGroups({
      authors: ctx.getAuthors(),
      selectedRelays: ctx.relays,
      purpose: 'write',
    }),
  );
}
