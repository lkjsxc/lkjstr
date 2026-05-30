import { encodedJsonBytes } from '../cache/cache-byte-size';
import { cacheLedgerId } from '../cache/cache-ledger-id';
import type { CacheLedgerRecord } from '../cache/cache-ledger-record';
import { cacheLedgerBytes } from '../cache/cache-ledger-bytes';
import { browserDb } from '../storage/browser-db';
import type { NotificationRecord } from './notification';

const importantKinds = new Set([
  'mention',
  'reply',
  'quote',
  'zap',
  'publish-failure',
]);

export function scoreNotification(record: NotificationRecord): number {
  const read = record.readAt !== null;
  const important = importantKinds.has(record.kind);
  const recency = Math.floor(record.createdAt / 3600) * 10;
  if (record.hidden || record.muted) return 100 + recency;
  if (read && !important) return 200 + recency;
  if (read && record.kind === 'profile-reference') return 300 + recency;
  if (read) return 400 + recency;
  if (!important) return 700 + recency;
  return 900 + recency;
}

export function notificationLedgerRecord(
  record: NotificationRecord,
  updatedAt = Date.now(),
): CacheLedgerRecord {
  const draft = notificationLedgerDraft(record, updatedAt);
  return {
    ...draft,
    cacheBytes:
      encodedJsonBytes(record) + cacheLedgerBytes({ ...draft, cacheBytes: 0 }),
  };
}

export async function putNotificationLedgerRows(
  records: readonly NotificationRecord[],
): Promise<void> {
  if (records.length === 0) return;
  await browserDb().cacheLedger.bulkPut(records.map(notificationLedgerRecord));
}

function notificationLedgerDraft(
  record: NotificationRecord,
  updatedAt: number,
): CacheLedgerRecord {
  return {
    id: cacheLedgerId('notification', record.id),
    ownerKind: 'notification',
    resourceKind: 'notification-record',
    resourceId: record.id,
    score: scoreNotification(record),
    createdAt: record.createdAt,
    updatedAt,
    cacheBytes: 0,
    protected: false,
    accountPubkey: record.accountPubkey,
    reason: record.readAt === null ? 'unread-notification' : 'read-notification',
  };
}
