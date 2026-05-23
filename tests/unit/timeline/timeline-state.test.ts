import { describe, expect, it } from 'vitest';
import { statusFromRelayState } from '../../../src/lib/timeline/timeline-state';
import type { RelaySnapshot } from '../../../src/lib/relays/types';

describe('timeline relay state', () => {
  it('is ready when one relay reaches eose and another is still connecting', () => {
    expect(
      statusFromRelayState(
        [
          snapshot('wss://a.example/', 'open', { notes: true }),
          snapshot('wss://b.example/', 'connecting', {}),
        ],
        [],
        false,
        false,
        'notes',
      ),
    ).toBe('ready-empty');
  });

  it('reports failure when every contacted relay is terminal', () => {
    expect(
      statusFromRelayState(
        [
          snapshot('wss://a.example/', 'error', {}),
          snapshot('wss://b.example/', 'closed', {}),
        ],
        [],
        false,
        false,
        'notes',
      ),
    ).toBe('relay-failed');
  });

  it('reports subscription closed when every relay closes that subscription', () => {
    expect(
      statusFromRelayState(
        [snapshot('wss://a.example/', 'open', {}, { notes: 'blocked' })],
        [],
        false,
        false,
        'notes',
      ),
    ).toBe('subscription-closed');
  });
});

function snapshot(
  url: string,
  state: RelaySnapshot['state'],
  eoseBySub: RelaySnapshot['eoseBySub'],
  closedBySub: RelaySnapshot['closedBySub'] = {},
): RelaySnapshot {
  return {
    url,
    state,
    validation: {
      validEventCount: 0,
      invalidEventCount: 0,
      invalidSubscriptionCount: 0,
    },
    diagnostics: [],
    eoseBySub,
    closedBySub,
  };
}
