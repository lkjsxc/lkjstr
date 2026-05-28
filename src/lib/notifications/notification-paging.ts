import { relaySegmentInitialSpan } from '../events/relay-page-segments';

export const notificationInitialLookbackSeconds = relaySegmentInitialSpan;
export const notificationOlderPageLookbackSeconds = relaySegmentInitialSpan;
export const notificationClockSkewSeconds = 120;

export type NotificationRelayCursor = {
  readonly since: number;
  readonly until: number;
};

export function initialNotificationCursor(
  startedAt: number,
): NotificationRelayCursor {
  return {
    since: Math.max(0, startedAt - notificationInitialLookbackSeconds),
    until: startedAt + notificationClockSkewSeconds,
  };
}

export function olderNotificationCursor(
  oldestCreatedAt: number,
): NotificationRelayCursor {
  return {
    since: Math.max(0, oldestCreatedAt - notificationOlderPageLookbackSeconds),
    // End strictly before the oldest retained record.
    until: Math.max(0, oldestCreatedAt - 1),
  };
}

export function isWithinNotificationCursor(
  createdAt: number,
  cursor: NotificationRelayCursor,
): boolean {
  return createdAt >= cursor.since && createdAt <= cursor.until;
}
