export const notificationInitialLookbackSeconds = 7 * 24 * 60 * 60;
export const notificationOlderPageLookbackSeconds =
  notificationInitialLookbackSeconds;
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
