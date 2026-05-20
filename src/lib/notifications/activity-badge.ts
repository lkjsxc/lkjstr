import type { NotificationKind } from './notification';

export type ActivityBadge = {
  readonly visible: boolean;
  readonly mark: string;
  readonly label: string;
};

export function activityBadge(kind: NotificationKind): ActivityBadge {
  if (kind === 'reaction')
    return { visible: true, mark: '♥', label: 'reacted to your note' };
  if (kind === 'repost')
    return { visible: true, mark: '↻', label: 'reposted your note' };
  return { visible: false, mark: '', label: '' };
}
