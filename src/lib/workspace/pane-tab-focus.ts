import type { TabGroup } from './tab-group';
import type { TabSnapshotPayload } from './tab-snapshot';
import {
  feedAnchorFromPayload,
  loadPersistedTabSnapshot,
  persistTabSnapshot,
  snapshotPayloadForTab,
} from './tab-snapshot-persist';
import type { WorkspaceTab } from './tab';
import type { PaneScrollRetention } from './pane-scroll-retention';
import type { SessionTabSnapshots } from './session-tab-snapshots';
import { clearRuntimeSnapshot } from './tab-runtime-registry';

type TabSnapshot = TabSnapshotPayload & { readonly id: string };

export type PaneFocusSync = {
  readonly restorePayload: TabSnapshotPayload | undefined;
  readonly restoreAnchor: ReturnType<typeof feedAnchorFromPayload>;
  readonly persistedTabId?: string;
  readonly persistedPayload?: TabSnapshotPayload;
};

export async function syncPaneTabFocus(args: {
  readonly workspaceId: string;
  readonly paneId: string;
  readonly active?: WorkspaceTab;
  readonly previousActiveId?: string;
  readonly tabs: Record<string, WorkspaceTab>;
  readonly group?: TabGroup;
  readonly inactiveRetentionSeconds: number;
  readonly bodyScroll: PaneScrollRetention;
  readonly snapshots: SessionTabSnapshots<TabSnapshot>;
}): Promise<PaneFocusSync> {
  const activeId = args.active?.id;
  let persistedTabId: string | undefined;
  let persistedPayload: TabSnapshotPayload | undefined;
  if (args.previousActiveId && args.previousActiveId !== activeId) {
    const previous = args.tabs[args.previousActiveId];
    if (previous && args.group?.tabIds.includes(previous.id)) {
      args.bodyScroll.remember(args.previousActiveId);
      const scrollTop =
        args.bodyScroll.snapshot(args.previousActiveId).scrollTop ?? 0;
      const payload = snapshotPayloadForTab(previous, scrollTop);
      persistedPayload = await persistTabSnapshot(
        args.workspaceId,
        args.paneId,
        previous,
        scrollTop,
      );
      persistedTabId = previous.id;
      if (args.inactiveRetentionSeconds > 0)
        args.snapshots.retain(
          { id: previous.id, ...payload },
          args.inactiveRetentionSeconds,
        );
    }
  }
  let restorePayload: TabSnapshotPayload | undefined;
  if (activeId) {
    const hadLiveScroll = args.bodyScroll.hasRememberedScroll(activeId);
    const session = args.snapshots.take(activeId);
    if (session) {
      restorePayload = session;
      clearRuntimeSnapshot(activeId);
      if (!hadLiveScroll)
        args.bodyScroll.restoreSnapshot(activeId, {
          scrollTop: session.scrollTop,
        });
    } else {
      const payload = await loadPersistedTabSnapshot(
        args.workspaceId,
        activeId,
      );
      if (payload && args.active?.id === activeId) {
        restorePayload = payload;
        clearRuntimeSnapshot(activeId);
        if (!hadLiveScroll)
          args.bodyScroll.restoreSnapshot(activeId, {
            scrollTop: payload.scrollTop,
          });
      }
    }
    if (!hadLiveScroll) args.bodyScroll.restore(activeId);
  }
  return {
    restorePayload,
    restoreAnchor: feedAnchorFromPayload(restorePayload),
    persistedTabId,
    persistedPayload,
  };
}
