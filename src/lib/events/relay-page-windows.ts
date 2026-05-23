import type { NostrFilter } from '../protocol';
import type { FeedCursorPoint } from './types';
import { boundarySince, boundaryUntil } from './relay-page-filter';

export type RelayPageDirection = 'older' | 'newer' | 'initial';

export type RelayWindowRequest = {
  readonly direction: RelayPageDirection;
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
  readonly now?: number;
};

const hour = 60 * 60;
const day = 24 * hour;
const spans = [6 * hour, day, 3 * day, 7 * day, 30 * day, 180 * day];

export function relayPageWindows(
  request: RelayWindowRequest,
): Pick<NostrFilter, 'since' | 'until'>[] {
  const now = request.now ?? Math.floor(Date.now() / 1000);
  if (request.direction === 'newer') return newerWindows(request, now);
  return olderWindows(request, now);
}

function olderWindows(
  request: RelayWindowRequest,
  now: number,
): Pick<NostrFilter, 'since' | 'until'>[] {
  const until = request.before ? boundaryUntil(request.before)! : now + 1;
  const schedule = spans.slice(firstSpanIndex(request.before, now));
  const windows: Pick<NostrFilter, 'since' | 'until'>[] = [];
  let upper = until;
  for (const span of schedule) {
    const since = Math.max(0, upper - span);
    windows.push({ since, until: upper });
    if (since === 0) return windows;
    upper = since + 1;
  }
  windows.push({ since: 0, until: upper });
  return windows;
}

function newerWindows(
  request: RelayWindowRequest,
  now: number,
): Pick<NostrFilter, 'since' | 'until'>[] {
  const end = now + 1;
  let lower = request.after
    ? boundarySince(request.after)!
    : Math.max(0, end - spans[0]!);
  const windows: Pick<NostrFilter, 'since' | 'until'>[] = [];
  for (const span of spans) {
    const until = Math.min(end, lower + span);
    windows.push({ since: lower, until });
    if (until >= end) return windows;
    lower = Math.max(0, until - 1);
  }
  windows.push({ since: lower, until: end });
  return windows;
}

function firstSpanIndex(
  cursor: FeedCursorPoint | undefined,
  now: number,
): number {
  if (!cursor) return 0;
  const age = Math.max(0, now - cursor.createdAt);
  if (age >= 30 * day) return spans.length - 1;
  if (age >= 7 * day) return spans.length - 2;
  if (age >= 3 * day) return spans.length - 3;
  if (age >= day) return 2;
  if (age >= 6 * hour) return 1;
  return 0;
}
