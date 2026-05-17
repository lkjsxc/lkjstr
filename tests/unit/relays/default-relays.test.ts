import { describe, expect, it } from 'vitest';
import { defaultRelaySet } from '../../../src/lib/relays/default-relays';
import { seedDefaultRelays } from '../../../src/lib/relays/relay-store';

describe('default relays', () => {
  it('seeds only when no relay set exists', () => {
    expect(seedDefaultRelays([])[0]).toMatchObject({
      id: 'public-default',
      seeded: true,
    });
    expect(defaultRelaySet.relays).toHaveLength(5);
    const custom = [{ ...defaultRelaySet, id: 'custom', relays: [] }];
    expect(seedDefaultRelays(custom)).toEqual(custom);
  });

  it('does not re-add a removed seeded relay when set exists', () => {
    const removed = [
      { ...defaultRelaySet, relays: defaultRelaySet.relays.slice(1) },
    ];
    expect(seedDefaultRelays(removed)[0]?.relays).toHaveLength(4);
  });
});
