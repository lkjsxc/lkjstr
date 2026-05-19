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
});
