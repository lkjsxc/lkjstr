import type { FeedCursorPoint } from '../events/types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { ThreadItem } from './thread-store';

export type ThreadPageRequest = {
  readonly eventId: string;
  readonly rootId: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
};

export function toThreadItems(
  events: readonly { event: ThreadItem['event']; relay: string }[],
): ThreadItem[] {
  return events.map((item) => ({ event: item.event, relays: [item.relay] }));
}

export function threadIntervalSince(cursor: FeedCursorPoint): number {
  return Math.max(0, cursor.createdAt - 30 * 24 * 60 * 60);
}

export function threadIntervalUntil(cursor: FeedCursorPoint): number {
  return cursor.createdAt + 30 * 24 * 60 * 60;
}
