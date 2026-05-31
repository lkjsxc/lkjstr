import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import type { TabSnapshotPayload } from './tab-snapshot';
import { cacheLedgerId } from '../cache/cache-ledger-id';
import { tabStateLedgerRecord } from './tab-state-ledger';

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
  const row = {
    id,
    workspaceId,
    tabId,
    lastPaneId,
    state,
    updatedAt: Date.now(),
  };
  await browserDb().transaction(
    'rw',
    browserDb().tabStates,
    browserDb().cacheLedger,
    async () => {
      await browserDb().tabStates.put(row);
      await browserDb().cacheLedger.put(tabStateLedgerRecord(row));
    },
  );
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
  const id = tabStateId(workspaceId, tabId);
  await browserDb().transaction(
    'rw',
    browserDb().tabStates,
    browserDb().cacheLedger,
    async () => {
      await browserDb().tabStates.delete(id);
      await browserDb().cacheLedger.delete(cacheLedgerId('tab-snapshot', id));
    },
  );
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
  if (stale.length === 0) return;
  await browserDb().transaction(
    'rw',
    browserDb().tabStates,
    browserDb().cacheLedger,
    async () => {
      await browserDb().tabStates.bulkDelete(stale);
      await browserDb().cacheLedger.bulkDelete(
        stale.map((id) => cacheLedgerId('tab-snapshot', id)),
      );
    },
  );
}
