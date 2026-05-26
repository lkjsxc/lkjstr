import type { WorkspaceTab } from './tab';
import type { TabFeedAnchor } from './tab-anchor-registry';
import {
  captureTabSnapshot,
  type FeedTabSnapshotSeed,
  type TabSnapshotPayload,
} from './tab-snapshot';
import { takeTabFeedAnchor } from './tab-anchor-registry';
import { deleteTabState, loadTabState, saveTabState } from './tab-states-store';
import { captureRuntimeSnapshot } from './tab-runtime-registry';
import { mergeTabSnapshotPayload } from './tab-snapshot-merge';

export type StoredTabSnapshot = TabSnapshotPayload & {
  readonly tabId: string;
};

export function snapshotPayloadForTab(
  tab: WorkspaceTab,
  scrollTop = 0,
): TabSnapshotPayload {
  const anchor = takeTabFeedAnchor(tab.id);
  const base = captureTabSnapshot(
    tab.kind,
    scrollTop,
    anchor ? { eventId: anchor.eventId, offset: anchor.offset } : undefined,
  );
  return mergeTabSnapshotPayload(base, captureRuntimeSnapshot(tab.id));
}

export function feedSnapshotSeedFromPayload(
  payload: TabSnapshotPayload | undefined,
): FeedTabSnapshotSeed | undefined {
  if (!payload || payload.kind !== 'feed') return undefined;
  return {
    oldestCursor: payload.oldestCursor,
    newestCursor: payload.newestCursor,
    hasOlder: payload.hasOlder,
    hasNewer: payload.hasNewer,
  };
}

export async function persistTabSnapshot(
  workspaceId: string,
  paneId: string,
  tab: WorkspaceTab,
  scrollTop = 0,
): Promise<TabSnapshotPayload> {
  const payload = snapshotPayloadForTab(tab, scrollTop);
  await saveTabState(workspaceId, paneId, tab.id, payload);
  return payload;
}

export async function loadPersistedTabSnapshot(
  workspaceId: string,
  paneId: string,
  tabId: string,
): Promise<TabSnapshotPayload | undefined> {
  return loadTabState(workspaceId, paneId, tabId);
}

export async function removePersistedTabSnapshot(
  workspaceId: string,
  paneId: string,
  tabId: string,
): Promise<void> {
  await deleteTabState(workspaceId, paneId, tabId);
}

export function feedAnchorFromPayload(
  payload: TabSnapshotPayload | undefined,
): TabFeedAnchor | undefined {
  if (!payload || payload.kind !== 'feed') return undefined;
  if (!payload.anchorEventId) return undefined;
  return {
    eventId: payload.anchorEventId,
    offset: payload.anchorOffset ?? 0,
  };
}
