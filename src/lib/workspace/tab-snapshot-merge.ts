import type {
  FeedTabSnapshot,
  TabSnapshotPayload,
  ToolTabSnapshot,
} from './tab-snapshot';

export function mergeTabSnapshotPayload(
  base: TabSnapshotPayload,
  patch?: Partial<TabSnapshotPayload>,
): TabSnapshotPayload {
  if (!patch) return base;
  if (base.kind === 'feed') {
    const feedPatch = patch as Partial<FeedTabSnapshot>;
    return {
      ...base,
      scrollTop: feedPatch.scrollTop ?? base.scrollTop,
      anchorEventId: feedPatch.anchorEventId ?? base.anchorEventId,
      anchorOffset: feedPatch.anchorOffset ?? base.anchorOffset,
      oldestCursor: feedPatch.oldestCursor ?? base.oldestCursor,
      newestCursor: feedPatch.newestCursor ?? base.newestCursor,
      hasOlder: feedPatch.hasOlder ?? base.hasOlder,
      hasNewer: feedPatch.hasNewer ?? base.hasNewer,
      filterState: { ...base.filterState, ...feedPatch.filterState },
      eventIds: feedPatch.eventIds ?? base.eventIds,
      notificationRecordIds:
        feedPatch.notificationRecordIds ?? base.notificationRecordIds,
      kind: 'feed',
    };
  }
  const toolPatch = patch as Partial<ToolTabSnapshot>;
  return {
    ...base,
    scrollTop: toolPatch.scrollTop ?? base.scrollTop,
    fields: { ...base.fields, ...toolPatch.fields },
    kind: 'tool',
  };
}
