import { feedWindowSize } from '../events/feed-window';
import {
  discoverRoutesForAuthors,
  planPagingRouteGroups,
} from '../relays/orchestration/route-plan';
import type { PoolEvent } from '../relays/relay-pool';
import {
  resolvePagingRoutePurpose,
  routeGroupFingerprint,
} from '../relays/orchestration/page-reads';
import { authorFilters } from './follow-list';
import { readyWithEventsState } from './timeline-state';
import { mergeTimelineItems } from './timeline-store';
import { loadInitialTimelinePage } from './timeline-runtime-paging';
import type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export async function refreshTimelineRoutesAfterInitialPage(
  ctx: TimelineNetworkCtx,
  onEvent: (event: PoolEvent) => void,
): Promise<void> {
  const run = ctx.getGeneration();
  const refreshRun = ctx.routeRefresh.generation + 1;
  ctx.routeRefresh.generation = refreshRun;
  if (ctx.isClosed()) return;
  const before = await routeFingerprint(ctx);
  await discoverRoutesForAuthors({
    authors: ctx.getAuthors(),
    selectedRelays: ctx.relays,
    key: `home:routes:${[...ctx.getAuthors()].sort().join(',')}`,
    subscriptions: ctx.subscriptions,
    signal: ctx.signal,
  }).catch(() => undefined);
  if (!refreshActive(ctx, run, refreshRun)) return;
  const after = await routeFingerprint(ctx);
  if (before === after) return;
  await replaceHomeNotesLive(ctx, after, onEvent);
  const page = await loadInitialTimelinePage({
    surface: ctx.surface,
    owner: ctx.owner,
    authors: ctx.getAuthors(),
    relays: ctx.relays,
    pageSize: ctx.pageSize,
    subscriptions: ctx.subscriptions,
    signal: ctx.signal,
  }).catch(() => undefined);
  if (!page || !refreshActive(ctx, run, refreshRun) || page.items.length === 0)
    return;
  ctx.setCached(mergeTimelineItems(page.items, ctx.items(), feedWindowSize));
  ctx.emit(ctx.nextState(readyWithEventsState(ctx.getState(), ctx.items())));
}

function refreshActive(
  ctx: TimelineNetworkCtx,
  run: number,
  refreshRun: number,
): boolean {
  return ctx.isActive(run) && ctx.routeRefresh.generation === refreshRun;
}

export async function routeFingerprint(
  ctx: TimelineNetworkCtx,
): Promise<string> {
  return routeGroupFingerprint(
    await planPagingRouteGroups({
      authors: ctx.getAuthors(),
      selectedRelays: ctx.relays,
      purpose: resolvePagingRoutePurpose({ surface: ctx.surface }),
    }),
  );
}

async function replaceHomeNotesLive(
  ctx: TimelineNetworkCtx,
  routeFingerprint: string,
  onEvent: (event: PoolEvent) => void,
): Promise<void> {
  if (ctx.surface !== 'home' || !ctx.activeAccountPubkey) return;
  if (ctx.routeRefresh.homeNotesFingerprint === routeFingerprint) return;
  ctx.liveHandles.release('notes');
  const release = await ctx.subscriptions.submitHomeNotesLiveIntent(
    {
      surface: 'home',
      owner: ctx.owner,
      channel: 'notes',
      visibility: ctx.visibility(),
      selectedRelays: ctx.relays,
      accountPubkey: ctx.activeAccountPubkey,
      authors: ctx.getAuthors(),
      sessionStartedAt: ctx.startedAt,
      filters: authorFilters(ctx.getAuthors(), ctx.pageSize, {
        since: Math.max(0, ctx.startedAt - 30),
      }),
    },
    onEvent,
  );
  ctx.liveHandles.replace('notes', release);
  ctx.routeRefresh.homeNotesFingerprint = routeFingerprint;
}
