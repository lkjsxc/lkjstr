import { describe, expect, it } from 'vitest';
import { relayPageDensity } from '../../../src/lib/events/relay-page-density';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';

describe('relay page density per relay rows', () => {
  it('allows one relay to be dense while another remains sparse', () => {
    const density = relayPageDensity(
      page([
        receipt('a', 'wss://dense/'),
        receipt('b', 'wss://dense/'),
        receipt('c', 'wss://sparse/'),
      ]),
      [{ kinds: [1], limit: 2 }],
      4,
    );

    expect(density.hitLimit).toBe(true);
    expect(density.perRelay).toEqual([
      expect.objectContaining({ relay: 'wss://dense/', hitLimit: true }),
      expect.objectContaining({ relay: 'wss://sparse/', hitLimit: false }),
    ]);
  });

  it('marks under-half only when every contacted relay is under half', () => {
    const density = relayPageDensity(
      page([
        receipt('a', 'wss://one/'),
        receipt('b', 'wss://two/'),
        receipt('c', 'wss://two/'),
        receipt('d', 'wss://two/'),
      ]),
      [{ kinds: [1], limit: 5 }],
      10,
    );

    expect(density.hitLimit).toBe(false);
    expect(density.underHalfLimit).toBe(false);
    expect(density.perRelay).toEqual([
      expect.objectContaining({ relay: 'wss://one/', underHalfLimit: true }),
      expect.objectContaining({ relay: 'wss://two/', underHalfLimit: false }),
    ]);
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
