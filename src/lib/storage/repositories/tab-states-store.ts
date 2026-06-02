import { tabStateLedgerRecord } from '../../workspace/tab-state-ledger';
import type { TabStateRecord } from '../tab-state-record';
import {
  sqliteDeleteTabStates,
  sqlitePutTabState,
  sqliteReadTabState,
  sqliteReadWorkspaceTabStates,
} from '../sqlite-opfs/tab-states-sqlite';

export async function putTabStateRow(row: TabStateRecord): Promise<void> {
  await sqlitePutTabState(row, tabStateLedgerRecord(row)).catch(() => false);
}

export async function readTabStateRow(
  id: string,
): Promise<TabStateRecord | undefined> {
  return sqliteReadTabState(id).catch(() => undefined);
}

export async function deleteTabStateRow(id: string): Promise<void> {
  await sqliteDeleteTabStates([id]).catch(() => false);
}

export async function deleteMissingTabStateRows(
  workspaceId: string,
  tabIds: ReadonlySet<string>,
): Promise<void> {
  const stale = await staleTabStateIds(workspaceId, tabIds);
  await sqliteDeleteTabStates(stale).catch(() => false);
}

async function staleTabStateIds(
  workspaceId: string,
  tabIds: ReadonlySet<string>,
): Promise<string[]> {
  const rows = await sqliteReadWorkspaceTabStates(workspaceId).catch(
    () => undefined,
  );
  return (rows ?? []).flatMap((record) => {
    const isWorkspaceRow =
      record.workspaceId === workspaceId ||
      record.id.startsWith(`${workspaceId}:`);
    if (!isWorkspaceRow) return [];
    if (record.workspaceId !== workspaceId) return [record.id];
    return tabIds.has(record.tabId) ? [] : [record.id];
  });
}
