import type { FeedCursorPoint } from '$lib/events/types';
import type { FeedTabSnapshot } from './tab-snapshot';

export type FeedRuntimeSnapshotSource = {
  readonly oldestCursor?: FeedCursorPoint;
  readonly newestCursor?: FeedCursorPoint;
  readonly hasOlder?: boolean;
  readonly hasNewer?: boolean;
  readonly eventIds?: readonly string[];
  readonly notificationRecordIds?: readonly string[];
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
    eventIds: state.eventIds?.slice(0, 200),
    notificationRecordIds: state.notificationRecordIds?.slice(0, 200),
  };
}
