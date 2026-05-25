import type { TabKind } from './tab';

export type FeedTabSnapshot = {
  readonly kind: 'feed';
  readonly scrollTop?: number;
  readonly anchorEventId?: string;
  readonly anchorOffset?: number;
};

export type ToolTabSnapshot = {
  readonly kind: 'tool';
  readonly scrollTop?: number;
  readonly fields?: Record<string, string>;
};

export type TabSnapshotPayload = FeedTabSnapshot | ToolTabSnapshot;

export function captureTabSnapshot(
  tabKind: TabKind,
  scrollTop: number,
  anchor?: { eventId: string; offset: number },
): TabSnapshotPayload {
  if (
    tabKind === 'timeline' ||
    tabKind === 'global' ||
    tabKind === 'profile' ||
    tabKind === 'notifications' ||
    tabKind === 'thread'
  ) {
    return {
      kind: 'feed',
      scrollTop,
      anchorEventId: anchor?.eventId,
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
