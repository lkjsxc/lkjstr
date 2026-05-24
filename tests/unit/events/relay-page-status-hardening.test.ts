import { beforeEach, describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import {
  appLogRecords,
  clearAppLogForTests,
} from '../../../src/lib/log/app-log';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type {
  ReadPageRelayStatus,
  ReadPageResult,
} from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://status-hardening.example/';

describe('relay page status hardening', () => {
  beforeEach(() => clearAppLogForTests());

  it.each<[string, Partial<ReadPageRelayStatus>, string]>([
    ['timeout', { timeout: true }, 'timeout'],
    ['closed', { closed: true }, 'closed'],
    ['auth', { auth: true }, 'auth'],
    ['socket closed', { socketClosed: true }, 'closed'],
    ['socket error', { socketError: true }, 'socket-error'],
    ['event limit', { eventLimitReached: true }, 'event-limit'],
  ])('keeps %s windows non-exhaustive', async (_name, status, reason) => {
    const page = await readRelayFeedGroups({
      key: `incomplete-${_name}`,
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'older',
      before: { createdAt: 200, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: statusSubscriptions(status),
    });

    expect(page.items).toEqual([]);
    expect(page.hasMorePossible).toBe(true);
    expect(appLogRecords()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'relay-feed-incomplete',
          context: expect.objectContaining({ reason }),
        }),
      ]),
    );
  });

  it('treats missing detailed status as incomplete', async () => {
    const page = await readRelayFeedGroups({
      key: 'missing-detailed-status',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'older',
      before: { createdAt: 200, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: {
        readPage: async () => [],
      } as unknown as RelaySubscriptionManager,
    });

    expect(page.hasMorePossible).toBe(true);
    expect(appLogRecords()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'relay-feed-incomplete',
          context: expect.objectContaining({ reason: 'missing-status' }),
        }),
      ]),
    );
  });
});

function statusSubscriptions(
  status: Partial<ReadPageRelayStatus>,
): RelaySubscriptionManager {
  return {
    readPageDetailed: async (request: RelayReadRequest) =>
      detailed([], request, status),
  } as unknown as RelaySubscriptionManager;
}

function detailed(
  events: readonly PoolEvent[],
  request: RelayReadRequest,
  status: Partial<ReadPageRelayStatus>,
): ReadPageResult {
  return {
    events: [...events],
    statuses: request.relays.map((url) => ({
      relay: url,
      eose: false,
      timeout: false,
      closed: false,
      auth: false,
      socketClosed: false,
      socketError: false,
      durationMs: 1,
      candidateCount: events.length,
      finalCount: events.length,
      ...status,
    })),
  };
}

function group() {
  return {
    key: 'group',
    relays: [relay],
    authors: ['a'.repeat(64)],
    source: 'fallback' as const,
  };
}
