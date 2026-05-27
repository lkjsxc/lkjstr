import type { FeedCursorPoint } from '../events/types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { TimelineState } from './timeline-state';
import type { TimelineItem } from './timeline-store';
import {
  globalPagingError,
  runGlobalLoadNewer,
  runGlobalLoadOlder,
} from './global-timeline-runtime-paging';

export type GlobalRuntimeHandlerCtx = {
  readonly owner: string;
  readonly relays: readonly string[];
  readonly pageSize: number;
  readonly limit: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly isClosed: () => boolean;
  readonly isActive: (run: number) => boolean;
  readonly getGeneration: () => number;
  readonly items: () => TimelineItem[];
  readonly getState: () => TimelineState;
  readonly emit: (next: TimelineState) => void;
  readonly nextState: (patch: Partial<TimelineState>) => TimelineState;
  readonly setCached: (items: TimelineItem[]) => void;
  readonly clearLive: () => void;
  readonly getOlderScanCursor: () => FeedCursorPoint | undefined;
  readonly setOlderScanCursor: (v: FeedCursorPoint | undefined) => void;
};

export async function globalRuntimeLoadOlder(
  ctx: GlobalRuntimeHandlerCtx,
): Promise<void> {
  const state = ctx.getState();
  if (ctx.isClosed() || state.loadingOlder || !state.hasOlder) return;
  const run = ctx.getGeneration();
  const cursor = ctx.getOlderScanCursor() ?? state.oldestCursor;
  if (!cursor) return;
  ctx.emit({ ...state, loadingOlder: true });
  try {
    await runGlobalLoadOlder({ ...ctx, cursor, state });
    if (!ctx.isActive(run)) return;
  } catch (error) {
    ctx.emit(globalPagingError(error, state));
  } finally {
    if (ctx.getState().loadingOlder)
      ctx.emit({ ...ctx.getState(), loadingOlder: false });
  }
}

export async function globalRuntimeLoadNewer(
  ctx: GlobalRuntimeHandlerCtx,
): Promise<void> {
  const state = ctx.getState();
  if (ctx.isClosed() || state.loadingNewer || !state.hasNewer) return;
  const run = ctx.getGeneration();
  const cursor = state.newestCursor;
  if (!cursor) return;
  ctx.emit({ ...state, loadingNewer: true });
  try {
    await runGlobalLoadNewer({ ...ctx, cursor, state });
    if (!ctx.isActive(run)) return;
  } catch (error) {
    ctx.emit(globalPagingError(error, state));
  } finally {
    if (ctx.getState().loadingNewer)
      ctx.emit({ ...ctx.getState(), loadingNewer: false });
  }
}

export function globalRuntimeSnapshot(ctx: GlobalRuntimeHandlerCtx) {
  return {
    kind: 'feed' as const,
    oldestCursor: ctx.getOlderScanCursor() ?? ctx.getState().oldestCursor,
    newestCursor: ctx.getState().newestCursor,
    hasOlder: ctx.getState().hasOlder,
    hasNewer: ctx.getState().hasNewer,
  } as const;
}
