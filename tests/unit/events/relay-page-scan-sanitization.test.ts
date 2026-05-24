import { describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrFilter } from '../../../src/lib/protocol';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://hardening.example/';

describe('relay page scan sanitization', () => {
  it('passes only relay bounds into adaptive scan filter builders', async () => {
    const dispatched: NostrFilter[] = [];
    await readRelayFeedGroups({
      key: 'segment-metadata',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'older',
      before: { createdAt: 1_000_000, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: {
        readPageDetailed: async (request: RelayReadRequest) => {
          dispatched.push(...request.filters);
          return detailed(request);
        },
      } as unknown as RelaySubscriptionManager,
    });

    expect(dispatched.length).toBeGreaterThan(1);
    for (const filter of dispatched) {
      expect(filter).toEqual(
        expect.objectContaining({
          since: expect.any(Number),
          until: expect.any(Number),
        }),
      );
      expect(Object.keys(filter)).not.toEqual(
        expect.arrayContaining(['depth', 'span', 'reason', 'attempt']),
      );
    }
  });
});

function detailed(request: RelayReadRequest): ReadPageResult {
  return {
    events: [],
    statuses: request.relays.map((url) => ({
      relay: url,
      eose: false,
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

function group() {
  return {
    key: 'group',
    relays: [relay],
    authors: ['a'.repeat(64)],
    source: 'fallback' as const,
  };
}
