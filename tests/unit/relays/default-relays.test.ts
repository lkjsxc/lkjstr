import { describe, expect, it } from 'vitest';
import {
  defaultDiscoveryRelaySet,
  defaultRelaySet,
} from '../../../src/lib/relays/default-relays';
import { seedDefaultRelays } from '../../../src/lib/relays/relay-store';

describe('default relays', () => {
  it('seeds user and discovery defaults only when no relay set exists', () => {
    const seeded = seedDefaultRelays([]);
    expect(seeded[0]).toMatchObject({
      id: 'public-default',
      purpose: 'user',
      seeded: true,
    });
    expect(seeded[1]).toMatchObject({
      id: 'discovery-default',
      purpose: 'discovery',
      seeded: true,
    });
    expect(defaultRelaySet.relays.map((relay) => relay.url)).toEqual([
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://offchain.pub',
      'wss://r.kojira.io',
      'wss://x.kojira.io',
      'wss://yabu.me',
    ]);
    expect(defaultDiscoveryRelaySet.relays.map((relay) => relay.url)).toEqual([
      'wss://purplepag.es/',
      'wss://directory.yabu.me/',
    ]);
    const custom = [{ ...defaultRelaySet, id: 'custom', relays: [] }];
    expect(seedDefaultRelays(custom)).toEqual(custom);
  });

  it('does not re-add a removed seeded relay when set exists', () => {
    const removed = [
      { ...defaultRelaySet, relays: defaultRelaySet.relays.slice(1) },
    ];
    expect(seedDefaultRelays(removed)[0]?.relays).toHaveLength(
      defaultRelaySet.relays.length - 1,
    );
  });

  it('normalizes only the seeded public default relay set', () => {
    const staleRelay = {
      ...defaultRelaySet.relays[0]!,
      url: 'wss://relay.nostr.band',
    };
    const staleDefault = {
      ...defaultRelaySet,
      relays: [...defaultRelaySet.relays, staleRelay],
    };
    const custom = {
      ...defaultRelaySet,
      id: 'custom',
      seeded: false,
      relays: [staleRelay],
    };
    const [normalized, preserved] = seedDefaultRelays([staleDefault, custom]);
    expect(normalized?.relays.map((relay) => relay.url)).not.toContain(
      'wss://relay.nostr.band',
    );
    expect(preserved?.relays.map((relay) => relay.url)).toEqual([
      'wss://relay.nostr.band',
    ]);
  });
});
