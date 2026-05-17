import { browserDb } from '../storage/browser-db';
import type { NotificationRecord } from './notification';

export async function saveNotifications(
  records: readonly NotificationRecord[],
): Promise<void> {
  await browserDb().notifications.bulkPut([...records]);
}

export async function accountNotifications(
  accountPubkey: string,
): Promise<NotificationRecord[]> {
  return browserDb()
    .notifications.where('accountPubkey')
    .equals(accountPubkey)
    .reverse()
    .sortBy('createdAt');
}

export async function markAccountNotificationsRead(
  accountPubkey: string,
): Promise<void> {
  const records = await accountNotifications(accountPubkey);
  const now = Date.now();
  await saveNotifications(
    records.map((record) =>
      record.readAt ? record : { ...record, readAt: now },
    ),
  );
}
