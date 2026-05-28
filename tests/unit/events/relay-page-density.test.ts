import { describe, expect, it } from 'vitest';
import { relayPageDensity } from '../../../src/lib/events/relay-page-density';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';

describe('relay page density', () => {
  it('classifies density per relay instead of aggregate receipts', () => {
    const result = page([
      receipt('a', 'wss://one/'),
      receipt('b', 'wss://two/'),
    ]);

    expect(relayPageDensity(result, [{ kinds: [1], limit: 2 }], 4)).toEqual(
      expect.objectContaining({
        dense: false,
        hitLimit: false,
        underHalfLimit: true,
        observedCount: 1,
      }),
    );
  });

  it('detects relay-effective budget saturation for one relay', () => {
    const result = page([
      receipt('a', 'wss://one/'),
      receipt('b', 'wss://one/'),
    ]);

    expect(relayPageDensity(result, [{ kinds: [1], limit: 2 }], 4)).toEqual(
      expect.objectContaining({
        dense: true,
        hitLimit: true,
        underHalfLimit: false,
        observedCount: 2,
        eventCount: 2,
        uniqueCount: 2,
        limit: 2,
      }),
    );
  });

  it('uses the combined relay-shaped budget for multi-filter reads', () => {
    const result = page([
      receipt('a', 'wss://one/'),
      receipt('b', 'wss://one/'),
      receipt('c', 'wss://one/'),
    ]);

    expect(
      relayPageDensity(
        result,
        [
          { kinds: [1], limit: 2 },
          { kinds: [6], limit: 2 },
        ],
        4,
      ),
    ).toEqual(
      expect.objectContaining({
        dense: false,
        hitLimit: false,
        underHalfLimit: false,
        limit: 4,
        observedCount: 3,
      }),
    );
  });

  it('marks under-half only when every relay is below half its budget', () => {
    const result = page([
      receipt('a', 'wss://one/'),
      receipt('b', 'wss://two/'),
    ]);

    expect(relayPageDensity(result, [{ kinds: [1], limit: 5 }], 4)).toEqual(
      expect.objectContaining({
        dense: false,
        hitLimit: false,
        underHalfLimit: true,
        observedCount: 1,
      }),
    );
  });

  it('separates exact-half and above-half feedback', () => {
    const result = page([
      receipt('a', 'wss://one/'),
      receipt('b', 'wss://one/'),
    ]);

    expect(relayPageDensity(result, [{ kinds: [1], limit: 4 }], 10)).toEqual(
      expect.objectContaining({
        underHalfLimit: true,
        observedCount: 2,
      }),
    );
    expect(
      relayPageDensity(
        page([
          receipt('a', 'wss://one/'),
          receipt('b', 'wss://one/'),
          receipt('c', 'wss://one/'),
        ]),
        [{ kinds: [1], limit: 5 }],
        10,
      ),
    ).toEqual(
      expect.objectContaining({
        hitLimit: false,
        underHalfLimit: false,
        observedCount: 3,
      }),
    );
  });

  it('uses relay status counts when retained events are below the limit', () => {
    const result = page([receipt('a', 'wss://one/')]);
    result.statuses[0] = {
      ...result.statuses[0]!,
      candidateCount: 4,
      finalCount: 4,
    };

    expect(relayPageDensity(result, [{ kinds: [1], limit: 4 }], 10)).toEqual(
      expect.objectContaining({
        dense: true,
        hitLimit: true,
        underHalfLimit: false,
        observedCount: 4,
        limit: 4,
      }),
    );
  });

  it('treats limit one as either empty under-half or one event limit-hit', () => {
    expect(relayPageDensity(page([]), [{ kinds: [1], limit: 1 }], 4)).toEqual(
      expect.objectContaining({
        hitLimit: false,
        underHalfLimit: true,
        observedCount: 0,
        limit: 1,
      }),
    );
    expect(
      relayPageDensity(
        page([receipt('a', 'wss://one/')]),
        [{ kinds: [1], limit: 1 }],
        4,
      ),
    ).toEqual(
      expect.objectContaining({
        hitLimit: true,
        underHalfLimit: false,
        observedCount: 1,
        limit: 1,
      }),
    );
  });
});

function page(events: readonly PoolEvent[]): ReadPageResult {
  const relays = [...new Set(events.map((item) => item.relay))];
  return {
    events: [...events],
    statuses: relays.map((relay) => {
      const count = events.filter((item) => item.relay === relay).length;
      return {
        relay,
        eose: true,
        timeout: false,
        closed: false,
        auth: false,
        socketClosed: false,
        socketError: false,
        durationMs: 1,
        candidateCount: count,
        finalCount: count,
      };
    }),
  };
}

function receipt(seed: string, relay: string): PoolEvent {
  return {
    relay,
    subId: 'sub',
    event: {
      id: seed.repeat(64).slice(0, 64),
      pubkey: 'a'.repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content: seed,
      sig: 'b'.repeat(128),
    },
  };
}
