import { describe, expect, it } from 'vitest';
import { buildLiveDemand } from '../../../../src/lib/relays/orchestration/demand-build';
import {
  demandToWireRequest,
  wireEquivalentFingerprint,
} from '../../../../src/lib/relays/orchestration/lease-key';

describe('wire-equivalent lease key', () => {
  it('matches when live filters differ only in redundant since', () => {
    const relays = ['wss://relay.example'];
    const authors = ['a'.repeat(64)];
    const since = 1_700_000_000;
    const a = buildLiveDemand(
      {
        surface: 'home',
        owner: 'tab-a',
        channel: 'notes',
        visibility: 'visible',
        selectedRelays: relays,
        filters: [{ kinds: [1], authors, since: since - 5, limit: 30 }],
        purpose: 'feed',
        since,
      },
      relays,
    );
    const b = buildLiveDemand(
      {
        surface: 'home',
        owner: 'tab-b',
        channel: 'notes',
        visibility: 'visible',
        selectedRelays: relays,
        filters: [{ kinds: [1], authors, since, limit: 30 }],
        purpose: 'feed',
        since,
      },
      relays,
    );
    expect(wireEquivalentFingerprint(a)).toBe(wireEquivalentFingerprint(b));
    expect(demandToWireRequest(a).key).toBe(demandToWireRequest(b).key);
  });
});
