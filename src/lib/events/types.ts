import type { NostrEvent, NostrFilter } from '../protocol';
import type { RelayRequestPurpose } from '../relays/relay-request-compat';
import type { RelaySubscriptionDescriptorInput } from '../relays/types';

export type FeedKind = 'home' | 'global' | 'profile' | 'thread';

export type StoredEvent = NostrEvent & {
  readonly receivedAt: number;
  readonly relayUrls: readonly string[];
};

export type EventRelayReceipt = {
  readonly id: string;
  readonly eventId: string;
  readonly relayUrl: string;
  readonly receivedAt: number;
};

export type EventTagRow = {
  readonly id: string;
  readonly eventId: string;
  readonly tagName: 'e' | 'p' | 'q' | 'a';
  readonly tagValue: string;
  readonly created_at: number;
};

export type FeedCursorPoint = {
  readonly createdAt: number;
  readonly id: string;
};

export type FeedCursor = {
  readonly id: string;
  readonly feedKey: string;
  readonly until?: number;
  readonly oldest?: FeedCursorPoint;
  readonly newest?: FeedCursorPoint;
  readonly updatedAt: number;
};

export type FeedCoverageStatus =
  | 'complete'
  | 'dense'
  | 'incomplete'
  | 'unresolved'
  | 'failed';

export type FeedCoverage = {
  readonly id: string;
  readonly feedKey: string;
  readonly relayUrl: string;
  readonly groupKey: string;
  readonly filterKey: string;
  readonly status: FeedCoverageStatus;
  readonly since?: number;
  readonly until?: number;
  readonly reason?: string;
  readonly limit?: number;
  readonly eventCount?: number;
  readonly uniqueCount?: number;
  readonly attempt?: number;
  readonly durationMs?: number;
  readonly spanSeconds?: number;
  readonly nextSpanSeconds?: number;
  readonly feedback?: 'limit-hit' | 'under-half' | 'balanced' | 'incomplete';
  readonly direction?: 'older' | 'newer' | 'initial';
  readonly updatedAt: number;
};

export type FeedQuery = {
  readonly kind: FeedKind;
  readonly kinds?: readonly number[];
  readonly authors?: readonly string[];
  readonly relays?: readonly string[];
  readonly eventId?: string;
  readonly since?: number;
  readonly until?: number;
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
  readonly limit?: number;
};

export type FeedPage = {
  readonly items: readonly FeedEvent[];
  readonly cursor?: FeedCursor;
  readonly hasMore: boolean;
};

export type FeedEvent = {
  readonly event: NostrEvent;
  readonly relays: readonly string[];
};

export type EventTreeNode = FeedEvent & {
  readonly children: readonly EventTreeNode[];
  readonly depth: number;
};

export type JobKind =
  | 'relay-subscription'
  | 'paged-backfill'
  | 'notification-sync'
  | 'publish'
  | 'cache-maintenance';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled';

export type JobRecord = {
  readonly id: string;
  readonly kind: JobKind;
  readonly status: JobStatus;
  readonly input: unknown;
  readonly parentId?: string;
  readonly rootId: string;
  readonly path: readonly string[];
  readonly label?: string;
  readonly progress?: JobProgress;
  readonly output?: readonly string[];
  readonly cancelRequestedAt?: number;
  readonly canceledBy?: string;
  readonly staleStartedAt?: number;
  readonly error?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt?: number;
};

export type JobProgress = {
  readonly current: number;
  readonly total?: number;
  readonly label?: string;
};

export type RelayReadRequest = {
  readonly key: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly purpose?: RelayRequestPurpose;
  readonly descriptor?: RelaySubscriptionDescriptorInput;
};
