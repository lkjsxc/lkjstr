import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { NotificationRecord } from '../../notifications/notification';
import { browserDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';
import { boundedStorageRead } from '../safe-storage';

export async function putNotificationRowsWithLedger(
  records: readonly NotificationRecord[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  if (records.length === 0) return;
  await withStorageTransaction({
    mode: 'rw',
    tables: ['notifications', 'cacheLedger'],
    purpose: 'notification-write',
    run: async (db) => {
      await db.notifications.bulkPut([...records]);
      await db.cacheLedger.bulkPut([...ledgerRows]);
    },
  });
}

export async function putNotificationCacheLedgerRows(
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  if (ledgerRows.length === 0) return;
  await withStorageTransaction({
    mode: 'rw',
    tables: ['cacheLedger'],
    purpose: 'notification-write',
    run: async (db) => {
      await db.cacheLedger.bulkPut([...ledgerRows]);
    },
  });
}

export async function readAccountNotificationRows(
  accountPubkey: string,
  limit: number,
  beforeCreatedAt: number,
  fallback: readonly NotificationRecord[],
): Promise<NotificationRecord[]> {
  return boundedStorageRead(
    () =>
      browserDb()
        .notifications.where('[accountPubkey+createdAt]')
        .between([accountPubkey, 0], [accountPubkey, beforeCreatedAt - 1])
        .reverse()
        .limit(limit)
        .toArray(),
    [...fallback],
  );
}
