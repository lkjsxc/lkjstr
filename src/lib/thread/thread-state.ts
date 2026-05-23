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
  readonly loadingNewer: boolean;
  readonly hasNewer: boolean;
  readonly newestCursor?: FeedCursorPoint;
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
    loadingNewer: false,
    hasNewer: false,
    newestCursor: undefined,
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
    newestCursor: cursorPoint(state.items.at(0)),
    oldestCreatedAt: oldestCreatedAt(state.items),
    oldestCursor: cursorPoint(state.items.at(-1)),
  };
}
