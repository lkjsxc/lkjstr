import type { FeedCursorPoint } from '$lib/events/types';
import type { HistoryExhaustion } from '$lib/feed-surface/paging-state';
import type { TabKind } from './tab';

export type FeedTabSnapshot = {
  readonly kind: 'feed';
  readonly scrollTop?: number;
  readonly anchorKey?: string;
  readonly anchorOffset?: number;
  readonly oldestCursor?: FeedCursorPoint;
  readonly newestCursor?: FeedCursorPoint;
  readonly hasOlder?: boolean;
  readonly hasNewer?: boolean;
  readonly historyExhaustion?: HistoryExhaustion;
  readonly olderCursorCreatedAt?: number;
  readonly filterState?: Record<string, string>;
  readonly eventIds?: readonly string[];
  readonly notificationRecordIds?: readonly string[];
};

export type ToolTabSnapshot = {
  readonly kind: 'tool';
  readonly scrollTop?: number;
  readonly fields?: Record<string, string>;
};

export type TabSnapshotRestore = {
  readonly token: string;
  readonly payload: TabSnapshotPayload;
};

export type FeedTabSnapshotSeed = Pick<
  FeedTabSnapshot,
  | 'oldestCursor'
  | 'newestCursor'
  | 'hasOlder'
  | 'hasNewer'
  | 'historyExhaustion'
  | 'olderCursorCreatedAt'
>;

export type TabSnapshotPayload = FeedTabSnapshot | ToolTabSnapshot;

export function captureTabSnapshot(
  tabKind: TabKind,
  scrollTop: number,
  anchor?: { anchorKey: string; offset: number },
): TabSnapshotPayload {
  if (
    tabKind === 'timeline' ||
    tabKind === 'global' ||
    tabKind === 'profile' ||
    tabKind === 'followees' ||
    tabKind === 'user-timeline' ||
    tabKind === 'notifications' ||
    tabKind === 'thread' ||
    tabKind === 'search' ||
    tabKind === 'custom-request' ||
    tabKind === 'author-context'
  ) {
    return {
      kind: 'feed',
      scrollTop,
      anchorKey: anchor?.anchorKey,
      anchorOffset: anchor?.offset,
    };
  }
  return { kind: 'tool', scrollTop };
}

export function mergeTabSnapshot(
  current: TabSnapshotPayload | undefined,
  scrollTop: number,
): TabSnapshotPayload {
  if (!current) return { kind: 'tool', scrollTop };
  return { ...current, scrollTop };
}
