import type { HistoryExhaustion } from '$lib/feed-surface/paging-state';
import type { ProfileSummary } from '$lib/identity/identity';
import type { NotificationState } from '$lib/notifications/notification-runtime';

export const notificationAutoFillAttemptCap = 4;
const notificationAutoFillAttempts = new Map<string, number>();

export function notificationAutoFillAttemptCount(tabId: string): number {
  return notificationAutoFillAttempts.get(tabId) ?? 0;
}

export function setNotificationAutoFillAttemptCount(
  tabId: string,
  attempts: number,
): void {
  notificationAutoFillAttempts.set(tabId, attempts);
}

export type ProfileMap = Record<string, ProfileSummary>;
export type NotificationViewState = NotificationState & {
  profiles: ProfileMap;
};

export function emptyNotificationViewState(): NotificationViewState {
  return {
    records: [],
    items: [],
    targetItems: [],
    loading: true,
    error: null,
    loadingOlder: false,
    hasOlder: true,
    historyExhaustion: 'unknown',
    oldestCreatedAt: undefined,
    olderCursorCreatedAt: undefined,
    newerPruned: false,
    profiles: {},
  };
}

export function notificationPagingReady(
  olderCursorCreatedAt: number | undefined,
): boolean {
  return olderCursorCreatedAt !== undefined;
}

export function shouldRenderNotificationScroll(input: {
  readonly recordCount: number;
  readonly hasOlder: boolean;
  readonly historyExhaustion?: HistoryExhaustion;
}): boolean {
  return (
    input.recordCount > 0 ||
    (input.hasOlder && input.historyExhaustion !== 'proven')
  );
}

export function shouldAttemptNotificationAutoFill(input: {
  readonly hasOlder: boolean;
  readonly loadingOlder: boolean;
  readonly olderPrefetchReady: boolean;
  readonly autoFillPending: boolean;
  readonly autoFillAttempts: number;
}): boolean {
  return (
    input.hasOlder &&
    !input.loadingOlder &&
    input.olderPrefetchReady &&
    !input.autoFillPending &&
    input.autoFillAttempts < notificationAutoFillAttemptCap
  );
}

export function shouldShowNotificationRetry(input: {
  readonly recordCount: number;
  readonly hasOlder: boolean;
  readonly loadingOlder: boolean;
  readonly olderPrefetchReady: boolean;
  readonly historyExhaustion?: HistoryExhaustion;
  readonly error?: string | null;
  readonly autoFillAttempts: number;
}): boolean {
  return (
    input.recordCount === 0 &&
    input.hasOlder &&
    !input.loadingOlder &&
    input.olderPrefetchReady &&
    !input.error &&
    input.historyExhaustion !== 'proven' &&
    input.autoFillAttempts >= notificationAutoFillAttemptCap
  );
}
