import type { TimelineItem } from '$lib/timeline/timeline-store';
import type { FeedCursorPoint } from '$lib/events/types';

export type UserTimelineMode =
  | 'discovering'
  | 'follow_graph'
  | 'target_posts_only';

export type UserTimelineSnapshot = {
  readonly mode: UserTimelineMode;
  readonly items: readonly TimelineItem[];
  readonly authors: readonly string[];
  readonly loading: boolean;
  readonly loadingOlder: boolean;
  readonly hasOlder: boolean;
  readonly nextOlderCursor?: FeedCursorPoint;
  readonly notice: string;
  readonly relayStatusText: string;
  readonly error: string | null;
};

export const userTimelineInitialSnapshot = (): UserTimelineSnapshot => ({
  mode: 'discovering',
  items: [],
  authors: [],
  loading: true,
  loadingOlder: false,
  hasOlder: false,
  notice: 'Discovering public follow graph...',
  relayStatusText: '',
  error: null,
});

export const degradedNotice =
  "Public follow graph unavailable; showing this user's own public posts.";
