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

type TabSnapshot = TabSnapshotPayload & { readonly id: string };

export type PaneFocusSync = {
  readonly restorePayload: TabSnapshotPayload | undefined;
  readonly restoreAnchor: ReturnType<typeof feedAnchorFromPayload>;
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
  let restorePayload: TabSnapshotPayload | undefined;
  if (activeId) {
    const session = args.snapshots.take(activeId);
    if (session) {
      restorePayload = session;
      args.bodyScroll.restoreSnapshot(activeId, {
        scrollTop: session.scrollTop,
      });
    } else {
      const payload = await loadPersistedTabSnapshot(
        args.workspaceId,
        args.paneId,
        activeId,
      );
      if (payload && args.active?.id === activeId) {
        restorePayload = payload;
        args.bodyScroll.restoreSnapshot(activeId, {
          scrollTop: payload.scrollTop,
        });
      }
    }
    args.bodyScroll.restore(activeId);
  }
  if (args.previousActiveId && args.previousActiveId !== activeId) {
    const previous = args.tabs[args.previousActiveId];
    if (previous && args.group?.tabIds.includes(previous.id)) {
      args.bodyScroll.remember(args.previousActiveId);
      const scrollTop =
        args.bodyScroll.snapshot(args.previousActiveId).scrollTop ?? 0;
      const payload = snapshotPayloadForTab(previous, scrollTop);
      void persistTabSnapshot(
        args.workspaceId,
        args.paneId,
        previous,
        scrollTop,
      );
      if (args.inactiveRetentionSeconds > 0)
        args.snapshots.retain(
          { id: previous.id, ...payload },
          args.inactiveRetentionSeconds,
        );
    }
  }
  return {
    restorePayload,
    restoreAnchor: feedAnchorFromPayload(restorePayload),
  };
}
