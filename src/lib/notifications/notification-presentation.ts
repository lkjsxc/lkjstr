import type { NotificationKind, NotificationRecord } from './notification';

const labels: Record<NotificationKind, string> = {
  mention: 'mentioned you',
  reply: 'replied to you',
  reaction: 'reacted to you',
  repost: 'reposted you',
  quote: 'quoted you',
  zap: 'zapped you',
  'profile-reference': 'referenced your profile',
  'publish-failure': 'failed to publish',
};

export function notificationActionLabel(kind: NotificationKind): string {
  return labels[kind];
}

export function notificationContext(record: NotificationRecord): string | null {
  if (validEventId(record.targetEventId))
    return `target ${shortEventId(record.targetEventId)}`;
  if (validEventId(record.rootEventId))
    return `root ${shortEventId(record.rootEventId)}`;
  if (record.targetEventId !== undefined || record.rootEventId !== undefined)
    return 'context unavailable';
  return null;
}

export function notificationContextEventId(
  record: NotificationRecord,
): string | null {
  if (validEventId(record.targetEventId)) return record.targetEventId;
  if (validEventId(record.rootEventId)) return record.rootEventId;
  return null;
}

function shortEventId(id: string): string {
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function validEventId(id: string | undefined): id is string {
  return /^[0-9a-f]{64}$/i.test(id ?? '');
}
