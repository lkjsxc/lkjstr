import { boundedErrorText } from '../events/runtime-error';
import type { FeedCursorPoint } from '../events/types';
import { loadNewerTimelinePage } from './timeline-runtime-paging';
import { runTimelineLoadOlder } from './timeline-runtime-older';
import { timelineRuntimeSnapshot } from './timeline-runtime-snapshot';
import { feedWindowSize } from '../events/feed-window';
import { mergeTimelineItems, type TimelineItem } from './timeline-store';
import type { TimelineState } from './timeline-state';

type PagingApiDeps = {
  readonly surface: import('../relays/orchestration/demand-types').DemandSurface;
  readonly owner: string;
  readonly isClosed: () => boolean;
  readonly isActive: (run: number) => boolean;
  readonly getState: () => TimelineState;
  readonly emit: (next: TimelineState) => void;
  readonly nextState: (patch: Partial<TimelineState>) => TimelineState;
  readonly items: () => TimelineItem[];
  readonly authors: () => string[];
  readonly relays: readonly string[];
  readonly noteSubId: string;
  readonly pageSize: number;
  readonly subscriptions: import('../relays/orchestration/orchestrator').SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly getOlderScanCursor: () => FeedCursorPoint | undefined;
  readonly setOlderScanCursor: (v: FeedCursorPoint | undefined) => void;
  readonly setCached: (v: TimelineItem[]) => void;
  readonly clearLive: () => void;
  readonly getGeneration: () => number;
  readonly bumpGeneration: () => number;
};

export function timelineRuntimePagingApi(deps: PagingApiDeps) {
  return {
    loadOlder: async (): Promise<void> => {
      const state = deps.getState();
      if (deps.isClosed() || state.loadingOlder || !state.hasOlder) return;
      const cursor = deps.getOlderScanCursor() ?? state.oldestCursor;
      if (!cursor || deps.authors().length === 0) return;
      deps.emit({ ...state, loadingOlder: true });
      try {
        await runTimelineLoadOlder({
          surface: deps.surface,
          owner: deps.owner,
          items: deps.items,
          authors: deps.authors(),
          relays: deps.relays,
          cursor,
          pageSize: deps.pageSize,
          subscriptions: deps.subscriptions,
          signal: deps.signal,
          state,
          emit: deps.emit,
          nextState: deps.nextState,
          setCached: deps.setCached,
          clearLive: deps.clearLive,
          setOlderScanCursor: deps.setOlderScanCursor,
        });
      } catch (error) {
        deps.emit({ ...state, error: boundedErrorText(error) });
      } finally {
        if (deps.getState().loadingOlder) {
          deps.emit({ ...deps.getState(), loadingOlder: false });
        }
      }
    },
    loadNewer: async (): Promise<void> => {
      const state = deps.getState();
      if (deps.isClosed() || state.loadingNewer || !state.hasNewer) return;
      const run = deps.getGeneration();
      const cursor = state.newestCursor;
      if (!cursor || deps.authors().length === 0) return;
      deps.emit({ ...state, loadingNewer: true });
      try {
        const page = await loadNewerTimelinePage({
          surface: deps.surface,
          owner: deps.owner,
          items: deps.items(),
          authors: deps.authors(),
          relays: deps.relays,
          cursor,
          pageSize: deps.pageSize,
          subscriptions: deps.subscriptions,
          signal: deps.signal,
        });
        if (!deps.isActive(run)) return;
        deps.setCached(
          mergeTimelineItems(page.items, deps.items(), feedWindowSize),
        );
        deps.clearLive();
        deps.emit(
          deps.nextState({
            items: deps.items(),
            hasNewer: page.hasNewer,
            hasOlder: state.hasOlder || page.hasOlder,
          }),
        );
      } catch (error) {
        deps.emit({ ...state, error: boundedErrorText(error) });
      } finally {
        if (deps.getState().loadingNewer) {
          deps.emit({ ...deps.getState(), loadingNewer: false });
        }
      }
    },
    snapshot: () =>
      timelineRuntimeSnapshot(deps.getState(), deps.getOlderScanCursor()),
  };
}
