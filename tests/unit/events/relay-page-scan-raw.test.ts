import { describe, expect, it } from 'vitest';
import { retainRelayCandidates } from '../../../src/lib/events/relay-page-scan-raw';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('relay page scan raw candidate retention', () => {
  it('retains newest deduplicated relay candidates with provenance', () => {
    const newest = event('new', 300);
    const same = event('same', 200);
    const retained = retainRelayCandidates({
      pageSize: 1,
      limit: 2,
      events: [
        { event: event('old', 100), relay: 'wss://a.example/', subId: 'a' },
        { event: same, relay: 'wss://a.example/', subId: 'a' },
        { event: same, relay: 'wss://b.example/', subId: 'b' },
        { event: newest, relay: 'wss://a.example/', subId: 'a' },
      ],
    });

    expect(retained.map((item) => item.event.id)).toEqual([newest.id, same.id]);
    expect(retained[1]?.relays).toEqual([
      'wss://a.example/',
      'wss://b.example/',
    ]);
  });
});

function event(seed: string, created_at: number): NostrEvent {
  return {
    id: seed
      .repeat(64)
      .slice(0, 64)
      .padEnd(64, seed.at(0) ?? '0'),
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: seed,
    sig: 'b'.repeat(128),
  };
}
