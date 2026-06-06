import type { TimelineItem } from '$lib/timeline/timeline-store';
import type { FeedCursorPoint } from '$lib/events/types';

export type UserTimelineMode =
  | 'discovering'
  | 'follow_graph'
  | 'target_posts_only';

export type UserTimelineDiscoveryState =
  | 'not-started'
  | 'loading-cache'
  | 'loading-selected-relays'
  | 'loading-target-routes'
  | 'loading-nip65-routes'
  | 'loading-provenance-routes'
  | 'partial'
  | 'target-posts-only'
  | 'incomplete'
  | 'failed'
  | 'auth-required'
  | 'rate-limited'
  | 'offline';

export type UserTimelineDiscovery = {
  readonly state: UserTimelineDiscoveryState;
  readonly attemptedRouteGroups: readonly string[];
  readonly successfulRouteGroups: readonly string[];
  readonly failedRouteGroups: readonly string[];
  readonly pendingRouteGroups: readonly string[];
  readonly followListEventId?: string;
  readonly newestFollowListCreatedAt?: number;
  readonly reasonCodes: readonly string[];
  readonly canRetry: boolean;
};

export type UserTimelineSnapshot = {
  readonly mode: UserTimelineMode;
  readonly discovery: UserTimelineDiscovery;
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
  discovery: {
    state: 'not-started',
    attemptedRouteGroups: [],
    successfulRouteGroups: [],
    failedRouteGroups: [],
    pendingRouteGroups: [],
    reasonCodes: [],
    canRetry: false,
  },
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

export const pendingTargetPostNotice =
  "Searching public follow graph; showing this user's own public posts meanwhile.";
