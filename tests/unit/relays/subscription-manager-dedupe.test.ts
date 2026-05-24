import { describe, expect, it, vi } from 'vitest';
import type { NostrFilter } from '../../../src/lib/protocol';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import {
  createRelaySubscriptionManager,
  relayFacingSubId,
} from '../../../src/lib/relays/subscription-manager';

describe('subscription manager read sharing', () => {
  it('dedupes matching in-flight page reads', async () => {
    const pool = createRelayPool();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onState').mockReturnValue(vi.fn());
    const manager = createRelaySubscriptionManager(pool);
    const request = {
      key: 'same-page',
      relays: ['relay.example'],
      filters: [{ kinds: [1] }],
      purpose: 'feed' as const,
    };

    await Promise.all([
      manager.readPage(request, { timeoutMs: 1 }),
      manager.readPage(request, { timeoutMs: 1 }),
    ]);

    expect(subscribe).toHaveBeenCalledOnce();
  });

  it('dedupes reads that differ only by internal filter metadata', async () => {
    const pool = createRelayPool();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onState').mockReturnValue(vi.fn());
    const manager = createRelaySubscriptionManager(pool);
    const base = {
      key: 'metadata-page',
      relays: ['relay.example'],
      purpose: 'feed' as const,
    };

    await Promise.all([
      manager.readPage(
        {
          ...base,
          filters: [{ kinds: [1], depth: 1 } as unknown as NostrFilter],
        },
        { timeoutMs: 1 },
      ),
      manager.readPage(
        {
          ...base,
          filters: [{ kinds: [1], span: 60 } as unknown as NostrFilter],
        },
        { timeoutMs: 1 },
      ),
    ]);

    expect(subscribe).toHaveBeenCalledOnce();
  });

  it('restores logical keys for live listeners', () => {
    const pool = createRelayPool();
    const logical = `live:${'a'.repeat(80)}`;
    const listener = vi.fn();
    let onEvent:
      | ((event: Parameters<Parameters<typeof pool.onEvent>[0]>[0]) => void)
      | undefined;
    vi.spyOn(pool, 'subscribe').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onEvent').mockImplementation((handler) => {
      onEvent = handler;
      return vi.fn();
    });

    createRelaySubscriptionManager(pool).subscribeLive(
      { key: logical, relays: ['relay.example'], filters: [{ kinds: [1] }] },
      listener,
    );
    onEvent?.({
      relay: 'relay.example',
      subId: relayFacingSubId(logical),
      event: nostrEvent('b'),
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ subId: logical }),
    );
  });
});

function nostrEvent(seed: string) {
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
