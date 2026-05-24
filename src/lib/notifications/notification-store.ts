import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import { createBoundedMap } from '../fp/bounded-map';
import type { NotificationRecord } from './notification';

const memoryNotifications = createBoundedMap<string, NotificationRecord>({
  maxSize: 1000,
});

export async function saveNotifications(
  records: readonly NotificationRecord[],
): Promise<void> {
  records.forEach((record) => memoryNotifications.set(record.id, record));
  await bestEffortStorageWrite(() =>
    browserDb().notifications.bulkPut([...records]),
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
  return boundedStorageRead(
    () =>
      browserDb()
        .notifications.where('[accountPubkey+createdAt]')
        .between([accountPubkey, 0], [accountPubkey, beforeCreatedAt - 1])
        .reverse()
        .limit(limit)
        .toArray()
        .then((records) => records.filter(isSupportedNotification)),
    fallback,
  );
}

function isSupportedNotification(record: NotificationRecord): boolean {
  return record.kind !== ('follow' as NotificationRecord['kind']);
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
