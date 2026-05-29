import type { FeedCursorPoint, FeedEvent } from './types';

export type SegmentRead = {
  readonly items: FeedEvent[];
  readonly receivedItems: FeedEvent[];
  readonly complete: boolean;
  readonly dense: boolean;
  readonly hitLimit: boolean;
  readonly underHalfLimit: boolean;
  readonly contacted: boolean;
  readonly source?: 'relay' | 'cache';
  readonly safeCursor?: FeedCursorPoint;
};

export function emptySegmentRead(): SegmentRead {
  return {
    items: [],
    receivedItems: [],
    complete: true,
    dense: false,
    hitLimit: false,
    underHalfLimit: true,
    contacted: false,
  };
}
