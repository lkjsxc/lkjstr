import type { NostrFilter } from '../protocol';
import type { FeedCursorPoint } from './types';
import {
  initialRelayPageSegment,
  nextGrownRelayPageSegment,
  relaySegmentMaxSegmentsPerPage,
} from './relay-page-segments';

export type RelayPageDirection = 'older' | 'newer' | 'initial';

export type RelayWindowRequest = {
  readonly direction: RelayPageDirection;
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
  readonly now?: number;
};

export function relayPageWindows(
  request: RelayWindowRequest,
): Pick<NostrFilter, 'since' | 'until'>[] {
  const windows: Pick<NostrFilter, 'since' | 'until'>[] = [];
  let segment = initialRelayPageSegment(request);
  for (let count = 0; count < relaySegmentMaxSegmentsPerPage; count += 1) {
    windows.push({ since: segment.since, until: segment.until });
    const next = nextGrownRelayPageSegment(segment, request);
    if (!next) break;
    segment = next;
  }
  return windows;
}
