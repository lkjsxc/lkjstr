import type { NostrFilter } from '../protocol';
import type { FeedCursorPoint } from './types';

export function boundaryUntil(
  cursor: FeedCursorPoint | undefined,
): number | undefined {
  return cursor ? cursor.createdAt + 1 : undefined;
}

export function boundarySince(
  cursor: FeedCursorPoint | undefined,
): number | undefined {
  if (!cursor) return undefined;
  return Math.max(0, cursor.createdAt - 1);
}

export function boundaryFilter(
  filter: NostrFilter,
  before?: FeedCursorPoint,
  after?: FeedCursorPoint,
): NostrFilter {
  const until = min(filter.until, boundaryUntil(before));
  const since = max(filter.since, boundarySince(after));
  return { ...filter, until, since };
}

export function positiveFilters(
  filters: readonly NostrFilter[],
  pageSize: number,
): NostrFilter[] {
  return filters
    .map((filter) => ({
      ...filter,
      limit: Math.max(1, filter.limit ?? pageSize),
    }))
    .filter((filter) => filter.limit > 0);
}

export function mergeBounds(
  filter: NostrFilter,
  bounds: Pick<NostrFilter, 'since' | 'until'>,
): NostrFilter {
  return {
    ...filter,
    since: max(filter.since, bounds.since),
    until: min(filter.until, bounds.until),
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
