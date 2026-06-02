import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { NotificationRecord } from '../../notifications/notification';
import {
  sqlitePutNotificationLedgerRows,
  sqlitePutNotificationsWithLedger,
  sqliteReadAccountNotifications,
} from '../sqlite-opfs/notifications-sqlite';

export async function putNotificationRowsWithLedger(
  records: readonly NotificationRecord[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  await sqlitePutNotificationsWithLedger(records, ledgerRows).catch(
    () => false,
  );
}

export async function putNotificationCacheLedgerRows(
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  await sqlitePutNotificationLedgerRows(ledgerRows).catch(() => false);
}

export async function readAccountNotificationRows(
  accountPubkey: string,
  limit: number,
  beforeCreatedAt: number,
  fallback: readonly NotificationRecord[],
): Promise<NotificationRecord[]> {
  return (
    (await sqliteReadAccountNotifications(
      accountPubkey,
      limit,
      beforeCreatedAt,
    ).catch(() => undefined)) ?? [...fallback]
  );
}
