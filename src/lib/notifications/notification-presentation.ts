import type { NotificationKind, NotificationRecord } from './notification';
import { parseReaction, type NostrEvent } from '../protocol';
import { visibleReactionDisplay } from '../events/reaction-display';

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

export function notificationActionText(
  record: NotificationRecord,
  source?: NostrEvent,
): string {
  if (record.kind === 'reaction' && source) {
    const reaction = parseReaction(source);
    if (reaction.kind === 'like')
      return `reacted with ${visibleReactionDisplay(reaction)}`;
    if (reaction.kind === 'dislike') return 'disliked your post';
    return `reacted with ${visibleReactionDisplay(reaction)}`;
  }
  if (record.kind === 'repost') return 'reposted your post';
  if (record.kind === 'quote') return 'quoted your post';
  if (record.kind === 'zap') return 'zapped your post';
  return notificationActionLabel(record.kind);
}

export function notificationContext(record: NotificationRecord): string | null {
  if (validEventId(record.targetEventId)) return 'target event';
  if (validEventId(record.rootEventId)) return 'thread root';
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

function validEventId(id: string | undefined): id is string {
  return /^[0-9a-f]{64}$/i.test(id ?? '');
}
