import { describe, expect, it } from 'vitest';
import { discoverAuthorRelayRoutes } from '../../../src/lib/relays/relay-discovery';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import {
  saveRelaySets,
  seedDefaultRelays,
} from '../../../src/lib/relays/relay-store';

describe('relay discovery', () => {
  it('requests only relay-list metadata for bulk author route discovery', async () => {
    await saveRelaySets(seedDefaultRelays([]));
    const requests: unknown[] = [];
    const subscriptions = {
      readPage: async (request: unknown) => {
        requests.push(request);
        return [];
      },
    } as unknown as RelaySubscriptionManager;

    await discoverAuthorRelayRoutes({
      authors: ['a'.repeat(64), 'b'.repeat(64)],
      selectedRelays: ['relay.example'],
      key: 'discover',
      subscriptions,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      relays: [
        'wss://relay.example/',
        'wss://directory.yabu.me/',
        'wss://purplepag.es/',
      ],
      filters: [{ kinds: [10002], limit: 2 }],
    });
  });
});
