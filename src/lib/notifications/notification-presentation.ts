import type { NotificationKind, NotificationRecord } from './notification';

const labels: Record<NotificationKind, string> = {
  mention: 'mentioned you',
  reply: 'replied to you',
  reaction: 'reacted to you',
  repost: 'reposted you',
  quote: 'quoted you',
  zap: 'zapped you',
  follow: 'followed you',
  'profile-reference': 'referenced your profile',
  'publish-failure': 'failed to publish',
};

export function notificationActionLabel(kind: NotificationKind): string {
  return labels[kind];
}

export function notificationContext(record: NotificationRecord): string | null {
  if (record.targetEventId)
    return `target ${shortEventId(record.targetEventId)}`;
  if (record.rootEventId) return `root ${shortEventId(record.rootEventId)}`;
  return null;
}

function shortEventId(id: string): string {
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
