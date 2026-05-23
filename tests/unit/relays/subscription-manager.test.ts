import { describe, expect, it, vi } from 'vitest';
import type { NostrFilter } from '../../../src/lib/protocol';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import {
  RelaySubscriptionManager,
  relayFacingSubId,
} from '../../../src/lib/relays/subscription-manager';
import { maxRelaySubscriptionIdLength } from '../../../src/lib/relays/subscription-id';

describe('subscription manager', () => {
  it('shares identical relay reads until the last listener cleans up', () => {
    const pool = new RelayPool();
    const cleanup = vi.fn();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(cleanup);
    const manager = new RelaySubscriptionManager(pool);
    const filters: NostrFilter[] = [{ kinds: [1], limit: 2 }];
    const request = { key: 'shared', relays: ['relay.example'], filters };
    const listener = () => undefined;
    const secondListener = () => undefined;

    const first = manager.subscribeLive(request, listener);
    const second = manager.subscribeLive(request, secondListener);
    expect(subscribe).toHaveBeenCalledOnce();

    first();
    expect(cleanup).not.toHaveBeenCalled();
    second();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('returns relay provenance for one-shot page reads', async () => {
    const pool = new RelayPool();
    const event = nostrEvent('a');
    const cleanup = vi.fn();
    let onEvent:
      | ((event: Parameters<Parameters<typeof pool.onEvent>[0]>[0]) => void)
      | undefined;
    let onState:
      | ((snapshots: Parameters<Parameters<typeof pool.onState>[0]>[0]) => void)
      | undefined;
    vi.spyOn(pool, 'subscribe').mockImplementation((_relays, subId) => {
      setTimeout(() => onEvent?.({ relay: 'relay.example', subId, event }));
      setTimeout(() =>
        onState?.([
          {
            url: 'relay.example',
            state: 'open',
            validation: validation(),
            diagnostics: [],
            eoseBySub: { [subId]: true },
            closedBySub: {},
          },
        ]),
      );
      return cleanup;
    });
    vi.spyOn(pool, 'onEvent').mockImplementation((handler) => {
      onEvent = handler;
      return vi.fn();
    });
    vi.spyOn(pool, 'onState').mockImplementation((handler) => {
      onState = handler;
      return vi.fn();
    });
    const manager = new RelaySubscriptionManager(pool);
    const page = await manager.readPage(
      { key: 'page', relays: ['relay.example'], filters: [{ kinds: [1] }] },
      { timeoutMs: 50 },
    );
    expect(page).toEqual([
      { relay: 'relay.example', subId: expect.any(String), event },
    ]);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('treats relay CLOSED as terminal for one-shot page reads', async () => {
    const pool = new RelayPool();
    const cleanup = vi.fn();
    vi.spyOn(pool, 'subscribe').mockImplementation((_relays, subId) => {
      setTimeout(() =>
        onState?.([
          {
            url: 'relay.example',
            state: 'open',
            validation: validation(),
            diagnostics: [],
            eoseBySub: {},
            closedBySub: { [subId]: 'too large' },
          },
        ]),
      );
      return cleanup;
    });
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    let onState:
      | ((snapshots: Parameters<Parameters<typeof pool.onState>[0]>[0]) => void)
      | undefined;
    vi.spyOn(pool, 'onState').mockImplementation((handler) => {
      onState = handler;
      return vi.fn();
    });
    const manager = new RelaySubscriptionManager(pool);
    const page = await manager.readPage(
      { key: 'page', relays: ['relay.example'], filters: [{ kinds: [1] }] },
      { timeoutMs: 5000 },
    );
    expect(page).toEqual([]);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('compacts long logical keys before subscribing to relays', () => {
    const pool = new RelayPool();
    const cleanup = vi.fn();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(cleanup);
    const manager = new RelaySubscriptionManager(pool);
    const key = `embed:${'a'.repeat(120)}`;
    const request = {
      key,
      relays: ['relay.example'],
      filters: [{ kinds: [1] }],
    };
    manager.subscribeLive(request, () => undefined);
    const sentId = subscribe.mock.calls[0]?.[1];
    expect(sentId).toBe(relayFacingSubId(key));
    expect(sentId).not.toBe(key);
    expect(sentId?.length).toBeLessThanOrEqual(maxRelaySubscriptionIdLength);
  });

  it('uses distinct relay ids for reads with the same key but different filters', async () => {
    const pool = new RelayPool();
    const cleanup = vi.fn();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(cleanup);
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onState').mockReturnValue(vi.fn());
    const manager = new RelaySubscriptionManager(pool);

    const first = manager.readPage(
      { key: 'same', relays: ['relay.example'], filters: [{ kinds: [1] }] },
      { timeoutMs: 1 },
    );
    const second = manager.readPage(
      { key: 'same', relays: ['relay.example'], filters: [{ kinds: [7] }] },
      { timeoutMs: 1 },
    );
    await Promise.all([first, second]);

    expect(subscribe.mock.calls[0]?.[1]).not.toBe(subscribe.mock.calls[1]?.[1]);
  });
});

function validation() {
  return {
    validEventCount: 0,
    invalidEventCount: 0,
    invalidSubscriptionCount: 0,
  };
}

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
