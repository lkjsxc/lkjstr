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

    expect(relayPageDensity(result, [{ kinds: [1], limit: 2 }], 4).dense).toBe(
      false,
    );
  });

  it('detects relay budget saturation for one relay', () => {
    const result = page([
      receipt('a', 'wss://one/'),
      receipt('b', 'wss://one/'),
    ]);

    expect(relayPageDensity(result, [{ kinds: [1], limit: 2 }], 4)).toEqual(
      expect.objectContaining({
        dense: true,
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
      ).dense,
    ).toBe(false);
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
