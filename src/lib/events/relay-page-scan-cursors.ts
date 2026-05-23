import {
  compareFeedCursorsDesc,
  newestFeedCursor,
  olderCursor,
  oldestFeedCursor,
  newerCursor,
} from './feed-cursor-order';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedCursorPoint, FeedEvent } from './types';

export function nextScanCursor(
  request: RelayGroupPageRequest,
  items: readonly FeedEvent[],
  safeCursor: FeedCursorPoint | undefined,
): FeedCursorPoint | undefined {
  const direction = request.direction ?? 'older';
  if (direction === 'newer') {
    const rendered = newestFeedCursor(items) ?? request.after;
    if (!safeCursor || !rendered) return safeCursor ?? rendered;
    return compareFeedCursorsDesc(safeCursor, rendered) > 0
      ? safeCursor
      : rendered;
  }
  const rendered = oldestFeedCursor(items) ?? request.before;
  if (!safeCursor || !rendered) return safeCursor ?? rendered;
  return compareFeedCursorsDesc(safeCursor, rendered) < 0
    ? safeCursor
    : rendered;
}

export function scanCursor(
  request: RelayGroupPageRequest,
  items: readonly FeedEvent[],
): FeedCursorPoint | undefined {
  return (request.direction ?? 'older') === 'newer'
    ? (newestFeedCursor(items) ?? request.after)
    : (oldestFeedCursor(items) ?? request.before);
}

export function mergeSafeCursor(
  request: RelayGroupPageRequest,
  current: FeedCursorPoint | undefined,
  incoming: FeedCursorPoint | undefined,
): FeedCursorPoint | undefined {
  return (request.direction ?? 'older') === 'newer'
    ? olderCursor(current, incoming)
    : newerCursor(current, incoming);
}
