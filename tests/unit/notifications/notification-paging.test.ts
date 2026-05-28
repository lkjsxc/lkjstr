import { describe, expect, it } from 'vitest';
import {
  initialNotificationCursor,
  isWithinNotificationCursor,
  notificationInitialLookbackSeconds,
  notificationOlderPageLookbackSeconds,
  olderNotificationCursor,
} from '../../../src/lib/notifications/notification-paging';
import { readInitialNotificationRelayPage } from '../../../src/lib/notifications/notification-runtime-initial';
import { loadOlderNotificationRelayPage } from '../../../src/lib/notifications/notification-runtime-older';
import type { ReadPageRelayStatus } from '../../../src/lib/relays/read-page-status';
import { stubOrchestrator } from '../relays/orchestration/orchestrator-mock';

describe('notification paging cursors', () => {
  it('initialNotificationCursor includes since and until', () => {
    const startedAt = 1_000_000;
    const cursor = initialNotificationCursor(startedAt);
    expect(cursor.since).toBeGreaterThanOrEqual(0);
    expect(cursor.until).toBe(startedAt + 120);
    expect(notificationInitialLookbackSeconds).toBe(720);
    expect(cursor.since).toBe(startedAt - 720);
  });

  it('olderNotificationCursor is bounded and ends before oldest', () => {
    const oldest = 700_000;
    const cursor = olderNotificationCursor(oldest);
    expect(cursor.since).toBeGreaterThanOrEqual(0);
    expect(cursor.until).toBe(oldest - 1);
    expect(notificationOlderPageLookbackSeconds).toBe(720);
    expect(cursor.since).toBe(oldest - 720);
  });

  it('isWithinNotificationCursor matches inclusive window', () => {
    const cursor = { since: 10, until: 20 };
    expect(isWithinNotificationCursor(10, cursor)).toBe(true);
    expect(isWithinNotificationCursor(20, cursor)).toBe(true);
    expect(isWithinNotificationCursor(9, cursor)).toBe(false);
    expect(isWithinNotificationCursor(21, cursor)).toBe(false);
  });

  it('seeds older cursor from empty initial windows', async () => {
    const startedAt = 5_000;
    const result = await readInitialNotificationRelayPage({
      accountPubkey: 'd'.repeat(64),
      relays: ['wss://relay.example/'],
      owner: 'notif-test',
      pageSize: 30,
      startedAt,
      subscriptions: stubOrchestrator({
        readPageByIntent: async () => ({ events: [], statuses: [] }),
      }),
      signal: new AbortController().signal,
      active: () => true,
      run: 1,
      baseRecords: [],
      windowLimit: 180,
    });

    expect(result.mergedRecords).toEqual([]);
    expect(result.olderCursorCreatedAt).toBe(startedAt - 720);
  });

  it('advances sparse complete older windows without ending history', async () => {
    const result = await loadOlderNotificationRelayPage({
      accountPubkey: 'a'.repeat(64),
      relays: ['wss://relay.example/'],
      owner: 'notif-test',
      pageSize: 30,
      olderCursorCreatedAt: 2_000,
      subscriptions: stubOrchestrator({
        readPageByIntent: async () => ({
          events: [],
          statuses: [completeStatus('wss://relay.example/')],
        }),
      }),
      signal: new AbortController().signal,
      active: () => true,
      run: 1,
      baseRecords: [],
      windowLimit: 180,
    });

    expect(result.olderCursorCreatedAt).toBe(1_280);
    expect(result.hasOlder).toBe(true);
    expect(result.historyExhaustion).toBe('probing');
  });

  it('proves exhaustion only at lower bound with complete reads', async () => {
    const result = await loadOlderNotificationRelayPage({
      accountPubkey: 'b'.repeat(64),
      relays: ['wss://relay.example/'],
      owner: 'notif-test',
      pageSize: 30,
      olderCursorCreatedAt: 100,
      subscriptions: stubOrchestrator({
        readPageByIntent: async () => ({
          events: [],
          statuses: [completeStatus('wss://relay.example/')],
        }),
      }),
      signal: new AbortController().signal,
      active: () => true,
      run: 1,
      baseRecords: [],
      windowLimit: 180,
    });

    expect(result.olderCursorCreatedAt).toBe(0);
    expect(result.hasOlder).toBe(false);
    expect(result.historyExhaustion).toBe('proven');
  });

  it('keeps incomplete lower-bound reads retryable', async () => {
    const result = await loadOlderNotificationRelayPage({
      accountPubkey: 'c'.repeat(64),
      relays: ['wss://relay.example/'],
      owner: 'notif-test',
      pageSize: 30,
      olderCursorCreatedAt: 100,
      subscriptions: stubOrchestrator({
        readPageByIntent: async () => ({
          events: [],
          statuses: [
            { ...completeStatus('wss://relay.example/'), timeout: true },
          ],
        }),
      }),
      signal: new AbortController().signal,
      active: () => true,
      run: 1,
      baseRecords: [],
      windowLimit: 180,
    });

    expect(result.olderCursorCreatedAt).toBe(100);
    expect(result.hasOlder).toBe(true);
    expect(result.historyExhaustion).toBe('unknown');
  });
});

function completeStatus(relay: string): ReadPageRelayStatus {
  return {
    relay,
    eose: true,
    timeout: false,
    closed: false,
    auth: false,
    socketClosed: false,
    socketError: false,
    durationMs: 1,
    candidateCount: 0,
    finalCount: 0,
  };
}
