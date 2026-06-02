import type { FeedCursorPoint } from '../events/types';
import type { DemandSurface } from '../relays/orchestration/demand-types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { OnProgressiveReadSnapshot } from '../relays/progressive-read-types';
import type { TimelineItem } from './timeline-store';

export type TimelineOlderRequest = {
  readonly surface: DemandSurface;
  readonly owner: string;
  readonly items: readonly TimelineItem[];
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly cursor: FeedCursorPoint;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
};

export type TimelineOlderResult = {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly hasNewer: boolean;
  readonly nextOlderCursor?: FeedCursorPoint;
  readonly incomplete?: boolean;
};

export type TimelineNewerResult = {
  readonly items: TimelineItem[];
  readonly hasNewer: boolean;
  readonly hasOlder: boolean;
  readonly nextNewerCursor?: FeedCursorPoint;
  readonly incomplete?: boolean;
};

export type TimelineInitialRequest = {
  readonly surface: DemandSurface;
  readonly owner: string;
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
};

export type TimelinePageResult = {
  readonly items: TimelineItem[];
  readonly hasOlder: boolean;
  readonly nextOlderCursor?: FeedCursorPoint;
  readonly incomplete?: boolean;
};
