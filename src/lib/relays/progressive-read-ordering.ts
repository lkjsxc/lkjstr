import { compareEventsDesc } from '../protocol';
import type { FeedCursorPoint } from '../events/types';
import type { PoolEvent } from './relay-pool';

export function sortPoolEvents(events: readonly PoolEvent[]): PoolEvent[] {
  return [...events].sort((a, b) => compareEventsDesc(a.event, b.event));
}

export function afterReadCursor(
  event: PoolEvent,
  cursor: FeedCursorPoint | undefined,
): boolean {
  if (!cursor) return true;
  if (event.event.created_at !== cursor.createdAt)
    return event.event.created_at < cursor.createdAt;
  return event.event.id > cursor.id;
}

export function beforeReadCursor(
  event: PoolEvent,
  cursor: FeedCursorPoint | undefined,
): boolean {
  if (!cursor) return true;
  if (event.event.created_at !== cursor.createdAt)
    return event.event.created_at > cursor.createdAt;
  return event.event.id < cursor.id;
}
