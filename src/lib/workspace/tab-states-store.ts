import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import type { TabSnapshotPayload } from './tab-snapshot';

export function tabStateId(
  workspaceId: string,
  paneId: string,
  tabId: string,
): string {
  return `${workspaceId}:${paneId}:${tabId}`;
}

export async function saveTabState(
  workspaceId: string,
  paneId: string,
  tabId: string,
  state: TabSnapshotPayload,
): Promise<void> {
  if (!indexedDbAvailable()) return;
  const id = tabStateId(workspaceId, paneId, tabId);
  await browserDb().tabStates.put({
    id,
    tabId,
    state,
    updatedAt: Date.now(),
  });
}

export async function loadTabState(
  workspaceId: string,
  paneId: string,
  tabId: string,
): Promise<TabSnapshotPayload | undefined> {
  if (!indexedDbAvailable()) return undefined;
  const record = await browserDb().tabStates.get(
    tabStateId(workspaceId, paneId, tabId),
  );
  return record?.state as TabSnapshotPayload | undefined;
}
