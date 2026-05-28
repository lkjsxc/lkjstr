import { boundedErrorText } from '../events/runtime-error';
import type { FeedCursorPoint } from '../events/types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { loadInitialGlobalPage } from './global-timeline-pages';
import {
  mergeProgressiveTimelineItems,
  progressiveTimelinePatch,
} from './timeline-progressive';
import { readyWithEventsState, type TimelineState } from './timeline-state';
import { mergeTimelineItems, type TimelineItem } from './timeline-store';

export async function runInitialGlobalPage(args: {
  readonly owner: string;
  readonly relays: readonly string[];
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly limit: number;
  readonly run: number;
  readonly isActive: (run: number) => boolean;
  readonly items: () => TimelineItem[];
  readonly getState: () => TimelineState;
  readonly getCached: () => TimelineItem[];
  readonly setCached: (items: TimelineItem[]) => void;
  readonly emit: (state: TimelineState) => void;
  readonly nextState: (patch: Partial<TimelineState>) => TimelineState;
  readonly setOlderScanCursor: (cursor: FeedCursorPoint | undefined) => void;
}): Promise<void> {
  try {
    const page = await loadInitialGlobalPage({
      owner: args.owner,
      relays: args.relays,
      pageSize: args.pageSize,
      subscriptions: args.subscriptions,
      signal: args.signal,
      onSnapshot: (snapshot) => {
        if (!args.isActive(args.run)) return;
        args.setCached(
          mergeProgressiveTimelineItems(args.getCached(), snapshot, args.limit),
        );
        args.emit(
          args.nextState(
            progressiveTimelinePatch(args.getState(), args.items(), snapshot),
          ),
        );
      },
    });
    if (!args.isActive(args.run)) return;
    args.setOlderScanCursor(page.hasOlder ? page.nextOlderCursor : undefined);
    args.setCached(mergeTimelineItems(page.items, args.items(), args.limit));
    args.emit(finalGlobalInitialState(args.getState(), args.items(), page));
  } catch (error) {
    args.emit({
      ...args.getState(),
      loading: false,
      error: boundedErrorText(error),
    });
  }
}

function finalGlobalInitialState(
  state: TimelineState,
  items: readonly TimelineItem[],
  page: Awaited<ReturnType<typeof loadInitialGlobalPage>>,
): TimelineState {
  return page.items.length > 0
    ? readyWithEventsState(state, items)
    : {
        ...state,
        loading: false,
        hasOlder: page.hasOlder,
        relayReadStatusText: '',
      };
}
