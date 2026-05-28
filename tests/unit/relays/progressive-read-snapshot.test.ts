import { describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '../../../src/lib/protocol';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import { createRelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

describe('progressive read snapshots', () => {
  it('emits partial and final snapshots without changing final results', async () => {
    const pool = createRelayPool();
    const event = nostrEvent('a');
    let onEvent:
      | ((event: Parameters<Parameters<typeof pool.onEvent>[0]>[0]) => void)
      | undefined;
    let onState:
      | ((snapshots: Parameters<Parameters<typeof pool.onState>[0]>[0]) => void)
      | undefined;
    vi.spyOn(pool, 'onEvent').mockImplementation((handler) => {
      onEvent = handler;
      return vi.fn();
    });
    vi.spyOn(pool, 'onState').mockImplementation((handler) => {
      onState = handler;
      return vi.fn();
    });
    vi.spyOn(pool, 'subscribe').mockImplementation((_relays, subId) => {
      setTimeout(() =>
        onEvent?.({ relay: 'wss://relay.example/', subId, event }),
      );
      setTimeout(() =>
        onState?.([
          {
            url: 'wss://relay.example/',
            state: 'open',
            validation: {
              validEventCount: 1,
              invalidEventCount: 0,
              invalidSubscriptionCount: 0,
            },
            diagnostics: [],
            eoseBySub: { [subId]: true },
            closedBySub: {},
          },
        ]),
      );
      return vi.fn();
    });
    const snapshots: string[] = [];
    const manager = createRelaySubscriptionManager(pool);
    const result = await manager.readPageDetailed(
      {
        key: 'progressive',
        relays: ['wss://relay.example/'],
        filters: [{ kinds: [1] }],
      },
      { timeoutMs: 50, onSnapshot: (s) => snapshots.push(s.status) },
    );
    expect(result.events).toHaveLength(1);
    expect(snapshots).toContain('partial');
    expect(result.snapshot?.status).toBe('complete');
  });
});

function nostrEvent(seed: string): NostrEvent {
  return {
    id: seed.repeat(64),
    pubkey: seed.repeat(64),
    created_at: 1,
    kind: 1,
    tags: [],
    content: '',
    sig: seed.repeat(128),
  };
}
