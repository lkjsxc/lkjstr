import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRelayRoutesForTests,
  saveAuthorRelayRoute,
  saveRouteBlock,
} from '../../../src/lib/relays/relay-route-store';
import { routedAuthorRelays } from '../../../src/lib/relays/relay-routing';

const author = 'a'.repeat(64);

describe('relay routing', () => {
  afterEach(() => clearRelayRoutesForTests());

  it('uses author routes before selected fallback relays', async () => {
    await saveAuthorRelayRoute({
      authorPubkey: author,
      relayUrl: 'route.example',
      source: 'nip65',
      purpose: 'write',
    });

    await expect(
      routedAuthorRelays({
        authors: [author],
        selectedRelays: ['selected.example'],
        purpose: 'write',
      }),
    ).resolves.toEqual(['wss://route.example/', 'wss://selected.example/']);
  });

  it('excludes blocked relay URLs', async () => {
    await saveAuthorRelayRoute({
      authorPubkey: author,
      relayUrl: 'blocked.example',
      source: 'nip65',
      purpose: 'write',
    });
    await saveRouteBlock('blocked.example', 'user-disabled');

    await expect(
      routedAuthorRelays({
        authors: [author],
        selectedRelays: ['blocked.example', 'fallback.example'],
        purpose: 'write',
      }),
    ).resolves.toEqual(['wss://fallback.example/']);
  });
});
