import { feedWindowSize, mergeFeedWindow } from '../events/feed-window';
import type { FeedCursorPoint } from '../events/types';
import type {
  TimelineNewerResult,
  TimelineOlderRequest,
  TimelineOlderResult,
  TimelinePageResult,
} from './timeline-runtime-paging';
import type { TimelineItem } from './timeline-store';

export type CachedTimelinePage = {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly hasNewer: boolean;
  readonly nextCursor?: FeedCursorPoint;
};

export function initialTimelineFromCache(
  page: CachedTimelinePage,
): TimelinePageResult {
  return {
    items: page.items,
    hasOlder: page.hasOlder,
    nextOlderCursor: page.nextCursor,
  };
}

export function olderTimelineFromCache(
  request: TimelineOlderRequest,
  page: CachedTimelinePage,
): TimelineOlderResult {
  const window = mergeFeedWindow(request.items, page.items, feedWindowSize, true);
  return {
    items: window.items,
    hasOlder: page.hasOlder,
    hasNewer: window.prunedNewer,
    nextOlderCursor: page.nextCursor,
  };
}

export function newerTimelineFromCache(
  request: TimelineOlderRequest,
  page: CachedTimelinePage,
): TimelineNewerResult {
  const window = mergeFeedWindow(request.items, page.items, feedWindowSize);
  return {
    items: window.items,
    hasNewer: page.hasNewer,
    hasOlder: window.prunedOlder,
    nextNewerCursor: page.nextCursor,
  };
}
