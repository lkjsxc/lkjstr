import type { NostrEvent, NostrFilter } from '../protocol';

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
  readonly tagName: 'e' | 'p';
  readonly tagValue: string;
  readonly created_at: number;
};

export type FeedCursor = {
  readonly id: string;
  readonly feedKey: string;
  readonly until?: number;
  readonly updatedAt: number;
};

export type FeedQuery = {
  readonly kind: FeedKind;
  readonly authors?: readonly string[];
  readonly eventId?: string;
  readonly until?: number;
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
  readonly error?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt?: number;
};

export type RelayReadRequest = {
  readonly key: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
};
