import type { NostrFilter } from '../protocol';
import type { FeedCursorPoint } from './types';
import { boundarySince, boundaryUntil } from './relay-page-filter';
import type { RelayPageDirection } from './relay-page-windows';

export const relaySegmentMinSpan = 1;
export const relaySegmentInitialSpan = 6 * 60 * 60;
export const relaySegmentMaxSpan = 180 * 24 * 60 * 60;
export const relaySegmentMaxSegmentsPerPage = 96;
export const relaySegmentMaxSplitDepth = 32;

export type RelayPageSegment = Pick<NostrFilter, 'since' | 'until'> & {
  readonly depth: number;
  readonly span: number;
};

export type RelaySegmentRequest = {
  readonly direction: RelayPageDirection;
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
  readonly now?: number;
};

export function initialRelayPageSegment(
  request: RelaySegmentRequest,
): RelayPageSegment {
  const now = request.now ?? Math.floor(Date.now() / 1000);
  if (request.direction === 'newer') {
    const until = now + 1;
    const lower = lowerBound(request);
    return segment(Math.max(lower, until - relaySegmentInitialSpan), until);
  }
  const until = request.before ? boundaryUntil(request.before)! : now + 1;
  return segment(Math.max(0, until - relaySegmentInitialSpan), until);
}

export function nextGrownRelayPageSegment(
  current: RelayPageSegment,
  request: RelaySegmentRequest,
): RelayPageSegment | undefined {
  const span = Math.min(
    relaySegmentMaxSpan,
    Math.max(relaySegmentMinSpan, current.span * 2),
  );
  if (request.direction === 'newer') {
    const lower = lowerBound(request);
    if ((current.since ?? 0) <= lower) return undefined;
    const until = (current.since ?? 0) + 1;
    return segment(Math.max(lower, until - span), until);
  }
  const until = (current.since ?? 0) + 1;
  if (until <= 1) return undefined;
  return segment(Math.max(0, until - span), until);
}

export function splitRelayPageSegment(
  current: RelayPageSegment,
  direction: RelayPageDirection,
): RelayPageSegment[] {
  if (!canSplitRelayPageSegment(current)) return [];
  const since = current.since ?? 0;
  const until = current.until ?? since;
  const mid = Math.floor((since + until) / 2);
  const older = segment(since, mid + 1, current.depth + 1);
  const newer = segment(mid, until, current.depth + 1);
  return direction === 'newer' ? [older, newer] : [newer, older];
}

export function canSplitRelayPageSegment(segment: RelayPageSegment): boolean {
  return (
    segment.depth < relaySegmentMaxSplitDepth &&
    Math.max(0, (segment.until ?? 0) - (segment.since ?? 0)) >
      relaySegmentMinSpan
  );
}

export function relayPageSegmentCursor(
  segment: RelayPageSegment,
  direction: RelayPageDirection,
): FeedCursorPoint {
  return direction === 'newer'
    ? { createdAt: segment.since ?? 0, id: '0'.repeat(64) }
    : { createdAt: Math.max(0, (segment.until ?? 1) - 1), id: 'f'.repeat(64) };
}

function lowerBound(request: RelaySegmentRequest): number {
  return request.after ? boundarySince(request.after)! : 0;
}

function segment(since: number, until: number, depth = 0): RelayPageSegment {
  return {
    since,
    until,
    depth,
    span: Math.max(relaySegmentMinSpan, until - since),
  };
}
