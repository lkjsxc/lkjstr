import { cursorPoint, oldestCreatedAt } from '../events/feed-window';
import type { FeedCursorPoint } from '../events/types';
import type { ReactionSummaryMap, RepostSummaryMap } from './thread-reactions';
import type { ThreadItem } from './thread-store';

export type ThreadState = {
  readonly items: readonly ThreadItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly eoseRelays: number;
  readonly loadingOlder: boolean;
  readonly hasOlder: boolean;
  readonly oldestCreatedAt?: number;
  readonly oldestCursor?: FeedCursorPoint;
  readonly newerPruned: boolean;
  readonly reactions: ReactionSummaryMap;
  readonly reposts: RepostSummaryMap;
};

export function emptyThreadState(): ThreadState {
  return {
    items: [],
    loading: true,
    error: null,
    eoseRelays: 0,
    loadingOlder: false,
    hasOlder: true,
    oldestCreatedAt: undefined,
    oldestCursor: undefined,
    newerPruned: false,
    reactions: {},
    reposts: {},
  };
}

export function withThreadCursors(state: ThreadState): ThreadState {
  return {
    ...state,
    oldestCreatedAt: oldestCreatedAt(state.items),
    oldestCursor: cursorPoint(state.items.at(-1)),
  };
}
