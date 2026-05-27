import { boundedErrorText } from '../events/runtime-error';
import type { FeedCursorPoint } from '../events/types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import {
  loadNewerGlobalPage,
  loadOlderGlobalPage,
} from './global-timeline-pages';
import { mergeTimelineItems, type TimelineItem } from './timeline-store';
import type { TimelineState } from './timeline-state';

export async function runGlobalLoadOlder(input: {
  readonly owner: string;
  readonly items: () => TimelineItem[];
  readonly relays: readonly string[];
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly limit: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly setCached: (items: TimelineItem[]) => void;
  readonly clearLive: () => void;
  readonly setOlderScanCursor: (cursor: FeedCursorPoint | undefined) => void;
  readonly state: TimelineState;
  readonly emit: (next: TimelineState) => void;
  readonly nextState: (patch: Partial<TimelineState>) => TimelineState;
}): Promise<void> {
  const page = await loadOlderGlobalPage({
    owner: input.owner,
    items: input.items(),
    relays: input.relays,
    cursor: input.cursor,
    pageSize: input.pageSize,
    subscriptions: input.subscriptions,
    signal: input.signal,
  });
  input.setCached(mergeTimelineItems(page.items, input.items(), input.limit));
  input.clearLive();
  input.setOlderScanCursor(page.hasOlder ? page.nextOlderCursor : undefined);
  input.emit(
    input.nextState({
      items: input.items(),
      hasOlder: page.hasOlder,
      hasNewer: input.state.hasNewer || page.hasNewer,
    }),
  );
}

export async function runGlobalLoadNewer(input: {
  readonly owner: string;
  readonly items: () => TimelineItem[];
  readonly relays: readonly string[];
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly setCached: (items: TimelineItem[]) => void;
  readonly clearLive: () => void;
  readonly state: TimelineState;
  readonly emit: (next: TimelineState) => void;
  readonly nextState: (patch: Partial<TimelineState>) => TimelineState;
}): Promise<void> {
  const page = await loadNewerGlobalPage({
    owner: input.owner,
    items: input.items(),
    relays: input.relays,
    cursor: input.cursor,
    pageSize: input.pageSize,
    subscriptions: input.subscriptions,
    signal: input.signal,
  });
  input.setCached(page.items);
  input.clearLive();
  input.emit(
    input.nextState({
      items: input.items(),
      hasNewer: page.hasNewer,
      hasOlder: input.state.hasOlder || page.hasOlder,
    }),
  );
}

export function globalPagingError(
  error: unknown,
  state: TimelineState,
): TimelineState {
  return { ...state, error: boundedErrorText(error) };
}
