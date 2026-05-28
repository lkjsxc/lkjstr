import { describe, expect, it } from 'vitest';
import { notificationViewRows } from '../../../src/lib/feed-surface/notification-view-rows';
import {
  notificationAutoFillAttemptCap,
  shouldRenderNotificationScroll,
  shouldShowNotificationRetry,
} from '../../../src/lib/tabs/notifications/notification-list-state';

describe('notification list view rows', () => {
  it('keeps the footer row when no notification records exist', () => {
    expect(notificationViewRows([])).toEqual([{ kind: 'footer' }]);
  });

  it('keeps the scroll surface for retryable empty history', () => {
    expect(
      shouldRenderNotificationScroll({
        recordCount: 0,
        hasOlder: true,
        historyExhaustion: 'unknown',
      }),
    ).toBe(true);
    expect(
      shouldRenderNotificationScroll({
        recordCount: 0,
        hasOlder: false,
        historyExhaustion: 'proven',
      }),
    ).toBe(false);
  });

  it('offers explicit retry only after bounded zero-record auto-fill', () => {
    const base = {
      recordCount: 0,
      hasOlder: true,
      loadingOlder: false,
      olderPrefetchReady: true,
      historyExhaustion: 'unknown' as const,
    };

    expect(
      shouldShowNotificationRetry({
        ...base,
        autoFillAttempts: notificationAutoFillAttemptCap - 1,
      }),
    ).toBe(false);
    expect(
      shouldShowNotificationRetry({
        ...base,
        autoFillAttempts: notificationAutoFillAttemptCap,
      }),
    ).toBe(true);
  });
});
