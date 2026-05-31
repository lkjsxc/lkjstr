import type { TabSnapshotPayload } from './tab-snapshot';
import {
  deleteMissingTabStateRows,
  deleteTabStateRow,
  putTabStateRow,
  readTabStateRow,
} from '../storage/repositories/tab-states-store';

export function tabStateId(workspaceId: string, tabId: string): string {
  return `${workspaceId}:${tabId}`;
}

export async function saveTabState(
  workspaceId: string,
  lastPaneId: string | undefined,
  tabId: string,
  state: TabSnapshotPayload,
): Promise<void> {
  const id = tabStateId(workspaceId, tabId);
  await putTabStateRow({
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
  const record = await readTabStateRow(tabStateId(workspaceId, tabId));
  if (record?.workspaceId !== workspaceId || record.tabId !== tabId)
    return undefined;
  return record?.state as TabSnapshotPayload | undefined;
}

export async function deleteTabState(
  workspaceId: string,
  tabId: string,
): Promise<void> {
  await deleteTabStateRow(tabStateId(workspaceId, tabId));
}

export async function deleteMissingTabStates(
  workspaceId: string,
  tabIds: ReadonlySet<string>,
): Promise<void> {
  await deleteMissingTabStateRows(workspaceId, tabIds);
}
