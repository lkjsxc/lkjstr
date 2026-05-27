import { describe, expect, it } from 'vitest';
import {
  initialNotificationCursor,
  isWithinNotificationCursor,
  olderNotificationCursor,
} from '../../../src/lib/notifications/notification-paging';

describe('notification paging cursors', () => {
  it('initialNotificationCursor includes since and until', () => {
    const startedAt = 1_000_000;
    const cursor = initialNotificationCursor(startedAt);
    expect(cursor.since).toBeGreaterThanOrEqual(0);
    expect(cursor.until).toBe(startedAt + 120);
    expect(cursor.since).toBe(startedAt - 604800);
  });

  it('olderNotificationCursor is bounded and ends before oldest', () => {
    const oldest = 700_000;
    const cursor = olderNotificationCursor(oldest);
    expect(cursor.since).toBeGreaterThanOrEqual(0);
    expect(cursor.until).toBe(oldest - 1);
    expect(cursor.since).toBe(oldest - 604800);
  });

  it('isWithinNotificationCursor matches inclusive window', () => {
    const cursor = { since: 10, until: 20 };
    expect(isWithinNotificationCursor(10, cursor)).toBe(true);
    expect(isWithinNotificationCursor(20, cursor)).toBe(true);
    expect(isWithinNotificationCursor(9, cursor)).toBe(false);
    expect(isWithinNotificationCursor(21, cursor)).toBe(false);
  });
});
