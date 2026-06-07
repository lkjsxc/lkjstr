import { createBoundedMap } from '../fp/bounded-map';
import {
  putNotificationRowsWithLedger,
  readAccountNotificationRows,
} from '../storage/repositories/notifications-store';
import { notificationLedgerRecord } from './notification-ledger';
import type { NotificationRecord } from './notification';

const memoryNotifications = createBoundedMap<string, NotificationRecord>({
  maxSize: 1000,
});

export async function saveNotifications(
  records: readonly NotificationRecord[],
): Promise<void> {
  records.forEach((record) => memoryNotifications.set(record.id, record));
  await putNotificationRowsWithLedger(
    records,
    records.map(notificationLedgerRecord),
  );
}

export async function accountNotifications(
  accountPubkey: string,
  limit = 30,
  beforeCreatedAt = Number.MAX_SAFE_INTEGER,
): Promise<NotificationRecord[]> {
  const fallback = [...memoryNotifications.values()]
    .filter((record) => record.accountPubkey === accountPubkey)
    .filter(isSupportedNotification)
    .filter((record) => record.createdAt < beforeCreatedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
  const records = await readAccountNotificationRows(
    accountPubkey,
    limit,
    beforeCreatedAt,
    fallback,
  );
  return records.filter(isSupportedNotification);
}

function isSupportedNotification(record: NotificationRecord): boolean {
  return record.kind !== ('follow' as NotificationRecord['kind']);
}
