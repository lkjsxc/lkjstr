import type { NostrEvent } from '../protocol';
import {
  notificationId,
  type NotificationKind,
  type NotificationRecord,
} from './notification';

export function deriveNotifications(
  accountPubkey: string,
  event: NostrEvent,
  relayUrls: readonly string[] = [],
  receivedAt = Date.now(),
): NotificationRecord[] {
  if (event.pubkey === accountPubkey) return [];
  const kinds = notificationKinds(accountPubkey, event);
  return kinds.map((kind) => ({
    id: notificationId(accountPubkey, event.id, kind),
    accountPubkey,
    sourceEventId: event.id,
    actorPubkey: event.pubkey,
    kind,
    createdAt: event.created_at,
    receivedAt,
    readAt: null,
    muted: false,
    hidden: false,
    rootEventId: rootEventId(event),
    targetEventId: targetEventId(event),
    relayUrls,
  }));
}

export function unreadCount(records: readonly NotificationRecord[]): number {
  return records.filter(
    (record) => !record.readAt && !record.muted && !record.hidden,
  ).length;
}

export function markRead(
  records: readonly NotificationRecord[],
  now = Date.now(),
): NotificationRecord[] {
  return records.map((record) =>
    record.readAt ? record : { ...record, readAt: now },
  );
}

function notificationKinds(
  accountPubkey: string,
  event: NostrEvent,
): NotificationKind[] {
  const mentionsAccount = event.tags.some(
    (tag) => tag[0] === 'p' && tag[1] === accountPubkey,
  );
  if (!mentionsAccount) return [];
  if (event.kind === 0) return ['profile-reference'];
  if (event.kind === 7) return ['reaction'];
  if (event.kind === 6) return ['repost'];
  if (event.kind === 3) return [];
  if (event.tags.some((tag) => tag[0] === 'q')) return ['quote'];
  if (event.tags.some((tag) => tag[0] === 'e')) return ['reply'];
  return ['mention'];
}

function rootEventId(event: NostrEvent): string | undefined {
  return event.tags.find((tag) => tag[0] === 'e' && tag[3] === 'root')?.[1];
}

function targetEventId(event: NostrEvent): string | undefined {
  return event.tags.find((tag) => tag[0] === 'e')?.[1];
}
