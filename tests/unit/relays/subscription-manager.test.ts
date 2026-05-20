import { describe, expect, it, vi } from 'vitest';
import type { NostrFilter } from '../../../src/lib/protocol';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

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
    vi.spyOn(pool, 'subscribe').mockReturnValue(cleanup);
    vi.spyOn(pool, 'onEvent').mockImplementation((handler) => {
      setTimeout(() =>
        handler({ relay: 'relay.example', subId: 'page', event }),
      );
      return vi.fn();
    });
    vi.spyOn(pool, 'onState').mockImplementation((handler) => {
      setTimeout(() =>
        handler([
          {
            url: 'relay.example',
            state: 'open',
            diagnostics: [],
            eoseBySub: { page: true },
            closedBySub: {},
          },
        ]),
      );
      return vi.fn();
    });
    const manager = new RelaySubscriptionManager(pool);
    const page = await manager.readPage(
      { key: 'page', relays: ['relay.example'], filters: [{ kinds: [1] }] },
      { timeoutMs: 50 },
    );
    expect(page).toEqual([{ relay: 'relay.example', subId: 'page', event }]);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('treats relay CLOSED as terminal for one-shot page reads', async () => {
    const pool = new RelayPool();
    const cleanup = vi.fn();
    vi.spyOn(pool, 'subscribe').mockReturnValue(cleanup);
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onState').mockImplementation((handler) => {
      setTimeout(() =>
        handler([
          {
            url: 'relay.example',
            state: 'open',
            diagnostics: [],
            eoseBySub: {},
            closedBySub: { page: 'too large' },
          },
        ]),
      );
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
