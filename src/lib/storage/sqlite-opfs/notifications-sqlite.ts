import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { NotificationRecord } from '../../notifications/notification';
import { ensureEventGraphSchema } from './event-schema';
import {
  cacheLedgerSqlStep,
  sqliteRecordBatch,
  sqliteRecordReadMany,
} from './sqlite-record-helpers';
import type { SqlStep } from './types';

export function sqlitePutNotificationsWithLedger(
  records: readonly NotificationRecord[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<boolean> {
  return sqliteRecordBatch(ensureEventGraphSchema, [
    ...records.map(notificationStep),
    ...ledgerRows.map(cacheLedgerSqlStep),
  ]);
}

export function sqlitePutNotificationLedgerRows(
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<boolean> {
  return sqliteRecordBatch(
    ensureEventGraphSchema,
    ledgerRows.map(cacheLedgerSqlStep),
  );
}

export function sqliteReadAccountNotifications(
  accountPubkey: string,
  limit: number,
  beforeCreatedAt: number,
): Promise<NotificationRecord[] | undefined> {
  return sqliteRecordReadMany<NotificationRecord>(
    ensureEventGraphSchema,
    'notifications',
    'account_pubkey = ?1 AND created_at < ?2 ORDER BY created_at DESC',
    [accountPubkey, beforeCreatedAt],
    limit,
  );
}

function notificationStep(record: NotificationRecord): SqlStep {
  return {
    statement:
      'INSERT INTO notifications (id, account_pubkey, source_event_id, actor_pubkey, kind, created_at, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      record.id,
      record.accountPubkey,
      record.sourceEventId,
      record.actorPubkey,
      record.kind,
      record.createdAt,
      JSON.stringify(record),
      Date.now(),
    ],
  };
}
