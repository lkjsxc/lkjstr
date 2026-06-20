import type { NotificationRecord } from './notification';

export type NotificationViewRow =
  | { readonly kind: 'record'; readonly record: NotificationRecord }
  | { readonly kind: 'footer' };

export function notificationViewRows(
  records: readonly NotificationRecord[],
): NotificationViewRow[] {
  return [
    ...records.map((record) => ({ kind: 'record' as const, record })),
    { kind: 'footer' as const },
  ];
}

export function notificationViewRowKey(row: NotificationViewRow): string {
  return row.kind === 'footer' ? '__footer__' : row.record.id;
}

export function notificationOpenReferenceIds(
  records: readonly NotificationRecord[],
): string[] {
  const ids = records.flatMap((record) => [
    record.sourceEventId,
    record.targetEventId,
    record.rootEventId,
  ]);
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}
