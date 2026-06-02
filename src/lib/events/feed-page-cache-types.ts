import type { PlannedTimelinePageIntent } from '../relays/orchestration/page-reads';
import type { RelayReadSubscriptions } from './relay-page';
import type { RelayGroupPageRequest } from './relay-page';
import type { RelayFilterBatch } from './relay-page-cache-plan';
import type { SegmentRead } from './relay-page-scan-types';
import type { FeedCursorPoint, FeedEvent } from './types';

export type FeedPageIntent = {
  readonly plan: PlannedTimelinePageIntent;
  readonly subscriptions: RelayReadSubscriptions;
  readonly maxSegments?: number;
};

export type FeedPagePlan = RelayGroupPageRequest;

export type CoverageProof = {
  readonly status: 'complete' | 'partial' | 'missing';
  readonly reason?: string;
  readonly uncovered: readonly RelayFilterBatch[];
};

export type CachedFeedPage = {
  readonly items: FeedEvent[];
  readonly hasOlder: boolean;
  readonly hasNewer: boolean;
  readonly nextCursor?: FeedCursorPoint;
  readonly proofStatus: CoverageProof['status'];
  readonly diagnosticReason?: string;
};

export type CacheFirstFeedDecision =
  | { readonly kind: 'complete-cache'; readonly page: CachedFeedPage }
  | {
      readonly kind: 'partial-cache';
      readonly page: CachedFeedPage;
      readonly uncovered: readonly RelayFilterBatch[];
      readonly reason: string;
    }
  | { readonly kind: 'miss'; readonly reason: string };

export type SegmentDecision = {
  readonly kind: 'complete' | 'partial' | 'miss';
  readonly read: SegmentRead;
  readonly uncovered: readonly RelayFilterBatch[];
  readonly reason: string;
};

export type PartialSegmentDecision =
  | { readonly kind: 'complete'; readonly read: SegmentRead }
  | {
      readonly kind: 'partial' | 'miss';
      readonly read: SegmentRead;
      readonly uncovered: readonly RelayFilterBatch[];
      readonly reason: string;
    };
