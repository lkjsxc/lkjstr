import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import type { TabSnapshotPayload } from './tab-snapshot';

export function tabStateId(workspaceId: string, tabId: string): string {
  return `${workspaceId}:${tabId}`;
}

export async function saveTabState(
  workspaceId: string,
  lastPaneId: string | undefined,
  tabId: string,
  state: TabSnapshotPayload,
): Promise<void> {
  if (!indexedDbAvailable()) return;
  const id = tabStateId(workspaceId, tabId);
  await browserDb().tabStates.put({
    id,
    workspaceId,
    tabId,
    lastPaneId,
    state,
    updatedAt: Date.now(),
  });
}

export async function loadTabState(
  workspaceId: string,
  tabId: string,
): Promise<TabSnapshotPayload | undefined> {
  if (!indexedDbAvailable()) return undefined;
  const record = await browserDb().tabStates.get(
    tabStateId(workspaceId, tabId),
  );
  if (record?.workspaceId !== workspaceId || record.tabId !== tabId)
    return undefined;
  return record?.state as TabSnapshotPayload | undefined;
}

export async function deleteTabState(
  workspaceId: string,
  tabId: string,
): Promise<void> {
  if (!indexedDbAvailable()) return;
  await browserDb().tabStates.delete(tabStateId(workspaceId, tabId));
}

export async function deleteMissingTabStates(
  workspaceId: string,
  tabIds: ReadonlySet<string>,
): Promise<void> {
  if (!indexedDbAvailable()) return;
  const stale: string[] = [];
  await browserDb().tabStates.each((record) => {
    const isWorkspaceRow =
      record.workspaceId === workspaceId ||
      record.id.startsWith(`${workspaceId}:`);
    if (isWorkspaceRow && record.workspaceId !== workspaceId)
      stale.push(record.id);
    else if (isWorkspaceRow && !tabIds.has(record.tabId)) stale.push(record.id);
  });
  if (stale.length > 0) await browserDb().tabStates.bulkDelete(stale);
}
