import { describe, expect, it, vi } from 'vitest';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

describe('subscription manager read limiter', () => {
  it('queues concurrent one-shot reads to the same relay', async () => {
    const pool = new RelayPool();
    const cleanup = vi.fn();
    const stateHandlers: ((
      snapshots: ReturnType<typeof snapshot>[],
    ) => void)[] = [];
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(cleanup);
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onState').mockImplementation((handler) => {
      stateHandlers.push(handler);
      return vi.fn();
    });
    const manager = new RelaySubscriptionManager(pool);

    const first = manager.readPage(
      {
        key: 'same-relay',
        relays: ['relay.example'],
        filters: [{ kinds: [1] }],
      },
      { timeoutMs: 5000 },
    );
    const second = manager.readPage(
      {
        key: 'same-relay',
        relays: ['wss://relay.example/'],
        filters: [{ kinds: [7] }],
      },
      { timeoutMs: 5000 },
    );

    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledOnce());
    const firstSubId = subscribe.mock.calls[0]?.[1] ?? '';
    stateHandlers[0]?.([snapshot('wss://relay.example/', firstSubId)]);
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2));
    const secondSubId = subscribe.mock.calls[1]?.[1] ?? '';
    stateHandlers[1]?.([snapshot('wss://relay.example/', secondSubId)]);
    await Promise.all([first, second]);
  });

  it('starts concurrent one-shot reads to different relays immediately', async () => {
    const pool = new RelayPool();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onState').mockReturnValue(vi.fn());
    const manager = new RelaySubscriptionManager(pool);

    const first = manager.readPage(
      {
        key: 'different-relays',
        relays: ['relay-one.example'],
        filters: [{ kinds: [1] }],
      },
      { timeoutMs: 1 },
    );
    const second = manager.readPage(
      {
        key: 'different-relays',
        relays: ['relay-two.example'],
        filters: [{ kinds: [7] }],
      },
      { timeoutMs: 1 },
    );

    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2));
    await Promise.all([first, second]);
  });

  it('releases a relay read slot after timeout', async () => {
    const pool = new RelayPool();
    const subscribe = vi.spyOn(pool, 'subscribe').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onEvent').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'onState').mockReturnValue(vi.fn());
    const manager = new RelaySubscriptionManager(pool);

    const first = manager.readPage(
      {
        key: 'timeout-release',
        relays: ['relay.example'],
        filters: [{ kinds: [1] }],
      },
      { timeoutMs: 1 },
    );
    const second = manager.readPage(
      {
        key: 'timeout-release',
        relays: ['relay.example'],
        filters: [{ kinds: [7] }],
      },
      { timeoutMs: 50 },
    );

    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2));
    await Promise.all([first, second]);
  });
});

function validation() {
  return {
    validEventCount: 0,
    invalidEventCount: 0,
    invalidSubscriptionCount: 0,
  };
}

function snapshot(url: string, subId: string) {
  return {
    url,
    state: 'open' as const,
    validation: validation(),
    diagnostics: [],
    eoseBySub: { [subId]: true },
    closedBySub: {},
  };
}
