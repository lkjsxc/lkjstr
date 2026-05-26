import type { FeedCursorPoint } from '../events/types';
import { feedRuntimeSnapshot } from '../workspace/feed-runtime-snapshot';
import type { FeedTabSnapshot } from '../workspace/tab-snapshot';
import type { TimelineState } from './timeline-state';

export function timelineRuntimeSnapshot(
  state: TimelineState,
  olderScanCursor?: FeedCursorPoint,
): Partial<FeedTabSnapshot> {
  return feedRuntimeSnapshot({
    oldestCursor: olderScanCursor ?? state.oldestCursor,
    newestCursor: state.newestCursor,
    hasOlder: state.hasOlder,
    hasNewer: state.hasNewer,
  });
}
