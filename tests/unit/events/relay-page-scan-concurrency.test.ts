import { describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import { saveRelayInformation } from '../../../src/lib/relays/relay-info';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

describe('relay page scan bounded concurrency', () => {
  it('requests independent route groups concurrently', async () => {
    const tracker = concurrencyTracker();

    await pageFor({
      groups: [group('one', ['wss://one/']), group('two', ['wss://two/'])],
      subscriptions: subscriptions(tracker),
    });

    expect(tracker.maxActive()).toBe(2);
  });

  it('requests independent relay/filter batches concurrently', async () => {
    await saveRelayInformation({
      relayUrl: 'wss://two/',
      fetchedAt: Date.now(),
      status: 'available',
      info: { limitation: { max_limit: 1 } },
    });
    const tracker = concurrencyTracker();

    await pageFor({
      groups: [group('one', ['wss://one/', 'wss://two/'])],
      subscriptions: subscriptions(tracker),
    });

    expect(tracker.maxActive()).toBe(2);
  });

  it('does not schedule reads when already aborted', async () => {
    const calls: RelayReadRequest[] = [];
    const controller = new AbortController();
    controller.abort();

    await pageFor({
      groups: [group('one', ['wss://one/'])],
      subscriptions: {
        readPageDetailed: async (request: RelayReadRequest) => {
          calls.push(request);
          return detailed(request);
        },
      } as unknown as RelaySubscriptionManager,
      signal: controller.signal,
    });

    expect(calls).toEqual([]);
  });
});

function pageFor(input: {
  readonly groups: ReturnType<typeof group>[];
  readonly subscriptions: RelaySubscriptionManager;
  readonly signal?: AbortSignal;
}) {
  return readRelayFeedGroups({
    key: `concurrency-${Math.random()}`,
    groups: input.groups,
    filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
    direction: 'older',
    before: { createdAt: 10_000, id: 'f'.repeat(64) },
    pageSize: 2,
    subscriptions: input.subscriptions,
    signal: input.signal,
  });
}

function subscriptions(tracker: ReturnType<typeof concurrencyTracker>) {
  return {
    readPageDetailed: async (request: RelayReadRequest) => {
      tracker.start();
      await Promise.resolve();
      tracker.stop();
      return detailed(request);
    },
  } as unknown as RelaySubscriptionManager;
}

function detailed(request: RelayReadRequest): ReadPageResult {
  return {
    events: [],
    statuses: request.relays.map((relay) => ({
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
    })),
  };
}

function group(key: string, relays: readonly string[]) {
  return { key, relays, authors: [], source: 'fallback' as const };
}

function concurrencyTracker() {
  let active = 0;
  let max = 0;
  return {
    start: () => {
      active += 1;
      max = Math.max(max, active);
    },
    stop: () => {
      active -= 1;
    },
    maxActive: () => max,
  };
}
