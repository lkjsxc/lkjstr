import { describe, expect, it, vi } from 'vitest';
import type { NostrFilter } from '../../../src/lib/protocol';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

describe('subscription manager sanitization', () => {
  it('subscribes live with relay-safe filters', () => {
    const pool = new RelayPool();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(vi.fn());
    const manager = new RelaySubscriptionManager(pool);
    const filter = {
      kinds: [1],
      limit: 2,
      '#e': ['a'],
      depth: 1,
      span: 10,
    } as unknown as NostrFilter;

    manager.subscribeLive(
      { key: 'safe-live', relays: ['relay.example'], filters: [filter] },
      () => undefined,
    );

    expect(subscribe.mock.calls[0]?.[2]).toEqual([
      { kinds: [1], limit: 2, '#e': ['a'] },
    ]);
  });

  it('reads pages with relay-safe filters', async () => {
    const pool = new RelayPool();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onState').mockReturnValue(vi.fn());
    const manager = new RelaySubscriptionManager(pool);

    await manager.readPage(
      {
        key: 'safe-page',
        relays: ['relay.example'],
        filters: [
          { kinds: [1], depth: 1, attempt: 2 } as unknown as NostrFilter,
        ],
      },
      { timeoutMs: 1 },
    );

    expect(subscribe.mock.calls[0]?.[2]).toEqual([{ kinds: [1] }]);
  });
});
