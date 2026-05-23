import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRelayRoutesForTests,
  saveAuthorRelayRoute,
  saveRouteBlock,
} from '../../../src/lib/relays/relay-route-store';
import {
  discoveryRelays,
  routedAuthorRelays,
  routeGroups,
} from '../../../src/lib/relays/relay-routing';

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

  it('keeps selected fallback after many capped author route groups', async () => {
    const authors = Array.from({ length: 16 }, (_, index) => pubkey(index));
    await Promise.all(
      authors.map((pubkey, index) =>
        saveAuthorRelayRoute({
          authorPubkey: pubkey,
          relayUrl: `route-${index}.example`,
          source: 'nip65',
          purpose: 'write',
        }),
      ),
    );

    const groups = await routeGroups({
      authors,
      selectedRelays: ['selected.example'],
      purpose: 'write',
    });

    expect(groups.filter((group) => group.source === 'nip65')).toHaveLength(12);
    expect(groups.at(-1)).toEqual(
      expect.objectContaining({
        source: 'fallback',
        relays: ['wss://selected.example/'],
      }),
    );
  });

  it('chunks selected fallback groups at two hundred authors', async () => {
    const authors = Array.from({ length: 401 }, (_, index) => pubkey(index));

    const groups = await routeGroups({
      authors,
      selectedRelays: ['selected.example'],
      purpose: 'write',
    });

    expect(groups.map((group) => group.authors?.length)).toEqual([200, 200, 1]);
  });

  it('appends discovery after selected fallback and filters blocked relays', async () => {
    await saveRouteBlock(discoveryRelays[0], 'user-disabled');

    const groups = await routeGroups({
      authors: [author],
      selectedRelays: ['selected.example'],
      purpose: 'write',
      includeDiscovery: true,
    });

    expect(groups.map((group) => group.source)).toEqual([
      'fallback',
      'discovery',
    ]);
    expect(groups.at(1)?.relays).not.toContain('wss://purplepag.es/');
    expect(groups.at(1)?.relays).toContain('wss://user.kindpag.es/');
  });
});

function pubkey(index: number): string {
  return index.toString(16).padStart(64, '0');
}
