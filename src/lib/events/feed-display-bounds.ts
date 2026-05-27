import type { NostrEvent } from '../protocol';
import { afterCursor, beforeCursor } from './repository-shared';
import type { FeedCursorPoint, FeedEvent } from './types';

export type FeedDisplayBounds = {
  readonly since?: number;
  readonly until?: number;
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
  readonly now?: number;
};

export function displayNow(): number {
  return Math.floor(Date.now() / 1000);
}

export function eventInDisplayBounds(
  event: Pick<NostrEvent, 'created_at' | 'id'>,
  bounds: FeedDisplayBounds = {},
): boolean {
  const now = bounds.now ?? displayNow();
  if (event.created_at > now) return false;
  if (bounds.since !== undefined && event.created_at < bounds.since)
    return false;
  if (bounds.until !== undefined && event.created_at >= bounds.until)
    return false;
  return beforeCursor(event, bounds.before) && afterCursor(event, bounds.after);
}

export function feedEventsInDisplayBounds(
  items: readonly FeedEvent[],
  bounds: FeedDisplayBounds = {},
): FeedEvent[] {
  return items.filter((item) => eventInDisplayBounds(item.event, bounds));
}

export function mergedDisplayBounds(
  base: FeedDisplayBounds = {},
  extra: FeedDisplayBounds = {},
): FeedDisplayBounds {
  return {
    before: extra.before ?? base.before,
    after: extra.after ?? base.after,
    since: max(base.since, extra.since),
    until: min(base.until, extra.until),
    now: min(base.now, extra.now),
  };
}

function min(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.min(left, right);
}

function max(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}
