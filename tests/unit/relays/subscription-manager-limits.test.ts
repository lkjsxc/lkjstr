import { describe, expect, it, vi } from 'vitest';
import { statusesComplete } from '../../../src/lib/events/relay-page-status';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import { createRelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

describe('subscription manager read limits', () => {
  it('closes page reads and marks coverage incomplete at maxEvents', async () => {
    const pool = createRelayPool();
    const cleanup = vi.fn();
    let onEvent:
      | ((event: Parameters<Parameters<typeof pool.onEvent>[0]>[0]) => void)
      | undefined;
    vi.spyOn(pool, 'onEvent').mockImplementation((handler) => {
      onEvent = handler;
      return vi.fn();
    });
    vi.spyOn(pool, 'onState').mockReturnValue(vi.fn());
    vi.spyOn(pool, 'subscribe').mockImplementation((_relays, subId) => {
      setTimeout(() => {
        onEvent?.({ relay: 'relay.example', subId, event: event('1') });
        onEvent?.({ relay: 'relay.example', subId, event: event('2') });
        onEvent?.({ relay: 'relay.example', subId, event: event('3') });
      });
      return cleanup;
    });
    const manager = createRelaySubscriptionManager(pool);
    const result = await manager.readPageDetailed(
      { key: 'page', relays: ['relay.example'], filters: [{ kinds: [1] }] },
      { timeoutMs: 5000, maxEvents: 2 },
    );
    expect(result.events.map((item) => item.event.content)).toEqual([
      'event 1',
      'event 2',
    ]);
    expect(result.statuses[0]?.eventLimitReached).toBe(true);
    expect(statusesComplete(result.statuses)).toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

function event(seed: string) {
  return {
    id: seed.repeat(64),
    pubkey: seed.repeat(64),
    created_at: Number(seed),
    kind: 1,
    tags: [],
    content: `event ${seed}`,
    sig: seed.repeat(128),
  };
}
