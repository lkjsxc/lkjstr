import { describe, expect, it } from 'vitest';
import {
  listRelaySets,
  saveRelaySets,
  type RelaySet,
} from '../../../src/lib/relays/relay-store';
import { recordRelayHealthEvidence } from '../../../src/lib/relays/relay-health';

describe('relay health persistence', () => {
  it('records counters and evidence without changing relay config', async () => {
    await saveRelaySets([relaySet('a', true)]);

    await recordRelayHealthEvidence('relay.example', { attempted: true });
    await recordRelayHealthEvidence('wss://relay.example/', {
      connectedAt: 123,
    });
    const [set] = await recordRelayHealthEvidence('relay.example', {
      failure: 'connect timeout',
    });
    const relay = set?.relays[0];

    expect(relay).toMatchObject({
      url: 'wss://relay.example/',
      label: 'Relay',
      enabled: true,
      read: true,
      write: true,
      lastConnectedAt: 123,
      lastError: 'connect timeout',
      health: { attempts: 1, successes: 1, failures: 1 },
    });
  });

  it('ignores disabled and missing relays', async () => {
    await saveRelaySets([relaySet('a', false)]);

    await recordRelayHealthEvidence('relay.example', {
      attempted: true,
      failure: 'blocked',
    });
    await recordRelayHealthEvidence('missing.example', { attempted: true });

    expect((await listRelaySets())[0]?.relays[0]?.health).toEqual({
      attempts: 0,
      successes: 0,
      failures: 0,
    });
  });

  it('resets stale live state on load while preserving health', async () => {
    await saveRelaySets([
      {
        ...relaySet('a', true),
        relays: [
          {
            ...relaySet('a', true).relays[0]!,
            state: 'open',
            lastConnectedAt: 321,
            health: { attempts: 2, successes: 1, failures: 0 },
          },
        ],
      },
    ]);

    expect((await listRelaySets())[0]?.relays[0]).toMatchObject({
      state: 'idle',
      lastConnectedAt: 321,
      health: { attempts: 2, successes: 1, failures: 0 },
    });
  });
});

function relaySet(id: string, enabled: boolean): RelaySet {
  return {
    id,
    name: id,
    purpose: 'user',
    seeded: false,
    updatedAt: 1,
    relays: [
      {
        url: 'wss://relay.example/',
        label: 'Relay',
        enabled,
        read: true,
        write: true,
        state: 'idle',
        updatedAt: 1,
        health: { attempts: 0, successes: 0, failures: 0 },
      },
    ],
  };
}
