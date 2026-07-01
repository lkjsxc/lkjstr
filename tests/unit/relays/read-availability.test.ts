import { describe, expect, it } from 'vitest';
import { defaultRelaySet } from '../../../src/lib/relays/default-relays';
import {
  durableRelayReadPlan,
  readRelaysAvailable,
  unavailableRelayReadPlan,
} from '../../../src/lib/relays/read-availability';

describe('read availability', () => {
  it('distinguishes durable no-read-relay from settings unavailable', () => {
    const durableEmpty = durableRelayReadPlan([
      {
        ...defaultRelaySet,
        relays: defaultRelaySet.relays.map((relay) => ({
          ...relay,
          read: false,
        })),
      },
    ]);
    const unavailable = unavailableRelayReadPlan('opfs-owner-held', 'allowed');

    expect(durableEmpty.source).toBe('durable-empty');
    expect(durableEmpty.relays).toEqual([]);
    expect(unavailable.source).toBe('session-default-public-read');
    expect(unavailable.relays.length).toBeGreaterThan(0);
    expect(unavailable.writeAllowed).toBe(false);
    expect(readRelaysAvailable(unavailable)).toBe(true);
  });

  it('keeps policy-forbidden unavailable separate from no enabled relay', () => {
    const plan = unavailableRelayReadPlan('web-lock-unavailable', 'forbidden');

    expect(plan).toEqual({
      source: 'settings-unavailable',
      relays: [],
      diagnostic: 'Relay settings unavailable: web-lock-unavailable.',
      writeAllowed: false,
    });
  });
});
