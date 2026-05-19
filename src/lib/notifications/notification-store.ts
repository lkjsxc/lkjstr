import { browserDb } from '../storage/browser-db';
import type { NotificationRecord } from './notification';

export async function saveNotifications(
  records: readonly NotificationRecord[],
): Promise<void> {
  await browserDb().notifications.bulkPut([...records]);
}

export async function accountNotifications(
  accountPubkey: string,
  limit = 30,
  beforeCreatedAt = Number.MAX_SAFE_INTEGER,
): Promise<NotificationRecord[]> {
  return browserDb()
    .notifications.where('[accountPubkey+createdAt]')
    .between([accountPubkey, 0], [accountPubkey, beforeCreatedAt - 1])
    .reverse()
    .limit(limit)
    .toArray();
}

export async function markAccountNotificationsRead(
  accountPubkey: string,
): Promise<void> {
  const records = await accountNotifications(accountPubkey, 5000);
  const now = Date.now();
  await saveNotifications(
    records.map((record) =>
      record.readAt ? record : { ...record, readAt: now },
    ),
  );
}
