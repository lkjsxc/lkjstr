import { cacheLedgerId } from '../../cache/cache-ledger-id';
import { tabStateLedgerRecord } from '../../workspace/tab-state-ledger';
import type { TabStateRecord } from '../browser-db';
import { browserDb } from '../browser-db';
import { boundedStorageRead } from '../safe-storage';
import { withStorageTransaction } from '../operation/transaction';

export async function putTabStateRow(row: TabStateRecord): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['tabStates', 'cacheLedger'],
    purpose: 'tab-snapshot-write',
    run: async (db) => {
      await db.tabStates.put(row);
      await db.cacheLedger.put(tabStateLedgerRecord(row));
    },
  });
}

export async function readTabStateRow(
  id: string,
): Promise<TabStateRecord | undefined> {
  return boundedStorageRead(() => browserDb().tabStates.get(id), undefined);
}

export async function deleteTabStateRow(id: string): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['tabStates', 'cacheLedger'],
    purpose: 'tab-snapshot-write',
    run: async (db) => {
      await db.tabStates.delete(id);
      await db.cacheLedger.delete(cacheLedgerId('tab-snapshot', id));
    },
  });
}

export async function deleteMissingTabStateRows(
  workspaceId: string,
  tabIds: ReadonlySet<string>,
): Promise<void> {
  const stale = await staleTabStateIds(workspaceId, tabIds);
  if (stale.length === 0) return;
  await withStorageTransaction({
    mode: 'rw',
    tables: ['tabStates', 'cacheLedger'],
    purpose: 'tab-snapshot-write',
    run: async (db) => {
      await db.tabStates.bulkDelete(stale);
      await db.cacheLedger.bulkDelete(
        stale.map((id) => cacheLedgerId('tab-snapshot', id)),
      );
    },
  });
}

async function staleTabStateIds(
  workspaceId: string,
  tabIds: ReadonlySet<string>,
): Promise<string[]> {
  const stale: string[] = [];
  try {
    await browserDb().tabStates.each((record) => {
      const isWorkspaceRow =
        record.workspaceId === workspaceId ||
        record.id.startsWith(`${workspaceId}:`);
      if (isWorkspaceRow && record.workspaceId !== workspaceId)
        stale.push(record.id);
      else if (isWorkspaceRow && !tabIds.has(record.tabId))
        stale.push(record.id);
    });
  } catch {
    return [];
  }
  return stale;
}
