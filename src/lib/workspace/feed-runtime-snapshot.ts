import type { FeedCursorPoint } from '$lib/events/types';
import type { FeedTabSnapshot } from './tab-snapshot';

export type FeedRuntimeSnapshotSource = {
  readonly oldestCursor?: FeedCursorPoint;
  readonly newestCursor?: FeedCursorPoint;
  readonly hasOlder?: boolean;
  readonly hasNewer?: boolean;
};

export function feedRuntimeSnapshot(
  state: FeedRuntimeSnapshotSource,
): Partial<FeedTabSnapshot> {
  return {
    kind: 'feed',
    oldestCursor: state.oldestCursor,
    newestCursor: state.newestCursor,
    hasOlder: state.hasOlder,
    hasNewer: state.hasNewer,
  };
}
