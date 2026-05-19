export type NotificationKind =
  | 'mention'
  | 'reply'
  | 'reaction'
  | 'repost'
  | 'quote'
  | 'zap'
  | 'profile-reference'
  | 'publish-failure';

export type NotificationRecord = {
  readonly id: string;
  readonly accountPubkey: string;
  readonly sourceEventId: string;
  readonly actorPubkey: string;
  readonly kind: NotificationKind;
  readonly createdAt: number;
  readonly receivedAt: number;
  readonly readAt: number | null;
  readonly muted: boolean;
  readonly hidden: boolean;
  readonly rootEventId?: string;
  readonly targetEventId?: string;
  readonly relayUrls: readonly string[];
};

export function notificationId(
  accountPubkey: string,
  sourceEventId: string,
  kind: NotificationKind,
): string {
  return `${accountPubkey}:${sourceEventId}:${kind}`;
}
