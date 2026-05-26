import type { TabSnapshotPayload } from './tab-snapshot';

export function mergeTabSnapshotPayload(
  base: TabSnapshotPayload,
  patch?: Partial<TabSnapshotPayload>,
): TabSnapshotPayload {
  if (!patch) return base;
  if (base.kind === 'feed') {
    const feedPatch = patch.kind === 'feed' ? patch : patch;
    return {
      ...base,
      scrollTop: feedPatch.scrollTop ?? base.scrollTop,
      anchorEventId: feedPatch.anchorEventId ?? base.anchorEventId,
      anchorOffset: feedPatch.anchorOffset ?? base.anchorOffset,
      oldestCursor:
        'oldestCursor' in feedPatch
          ? feedPatch.oldestCursor
          : base.oldestCursor,
      newestCursor:
        'newestCursor' in feedPatch
          ? feedPatch.newestCursor
          : base.newestCursor,
      hasOlder: 'hasOlder' in feedPatch ? feedPatch.hasOlder : base.hasOlder,
      hasNewer: 'hasNewer' in feedPatch ? feedPatch.hasNewer : base.hasNewer,
      filterState: {
        ...base.filterState,
        ...('filterState' in feedPatch ? feedPatch.filterState : undefined),
      },
      kind: 'feed',
    };
  }
  return {
    ...base,
    scrollTop: patch.scrollTop ?? base.scrollTop,
    fields: {
      ...base.fields,
      ...('fields' in patch ? patch.fields : undefined),
    },
    kind: 'tool',
  };
}
