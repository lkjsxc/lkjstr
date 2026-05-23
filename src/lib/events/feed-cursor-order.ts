import type { FeedCursorPoint, FeedEvent } from './types';

export function compareFeedCursorsDesc(
  a: FeedCursorPoint,
  b: FeedCursorPoint,
): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id.localeCompare(b.id);
}

export function cursorForFeedEvent(
  item: FeedEvent | undefined,
): FeedCursorPoint | undefined {
  return item
    ? { createdAt: item.event.created_at, id: item.event.id }
    : undefined;
}

export function newestFeedCursor(
  items: readonly FeedEvent[],
): FeedCursorPoint | undefined {
  return cursorForFeedEvent(items.at(0));
}

export function oldestFeedCursor(
  items: readonly FeedEvent[],
): FeedCursorPoint | undefined {
  return cursorForFeedEvent(items.at(-1));
}

export function newerCursor(
  a: FeedCursorPoint | undefined,
  b: FeedCursorPoint | undefined,
): FeedCursorPoint | undefined {
  if (!a) return b;
  if (!b) return a;
  return compareFeedCursorsDesc(a, b) <= 0 ? a : b;
}

export function olderCursor(
  a: FeedCursorPoint | undefined,
  b: FeedCursorPoint | undefined,
): FeedCursorPoint | undefined {
  if (!a) return b;
  if (!b) return a;
  return compareFeedCursorsDesc(a, b) >= 0 ? a : b;
}
