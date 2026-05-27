import { describe, expect, it } from 'vitest';
import type { RelaySnapshot } from '../../../src/lib/relays/types';
import {
  followDiscoveryFinishedWithoutList,
} from '../../../src/lib/timeline/timeline-relay-state';
import {
  relaySnapshotCounts,
  statusFromRelayState,
} from '../../../src/lib/timeline/timeline-relay-eose';

function snapshot(input: {
  url: string;
  eoseBySub?: Record<string, boolean>;
  closedBySub?: Record<string, string>;
  state?: RelaySnapshot['state'];
}): RelaySnapshot {
  return {
    url: input.url,
    state: input.state ?? 'open',
    diagnostics: [],
    eoseBySub: input.eoseBySub ?? {},
    closedBySub: input.closedBySub ?? {},
    validation: {
      validEventCount: 0,
      invalidEventCount: 0,
      invalidSubscriptionCount: 0,
    },
  };
}

describe('timeline relay state ownership', () => {
  it('followDiscoveryFinishedWithoutList ignores unrelated EOSE', () => {
    const followSubId = 'timeline-test:follows';
    const active = [
      snapshot({
        url: 'relay-one.example',
        eoseBySub: { 'timeline-test:metadata': true },
      }),
      snapshot({
        url: 'relay-two.example',
        eoseBySub: { 'timeline-test:metadata': true },
      }),
    ];

    expect(
      followDiscoveryFinishedWithoutList(active, false, false, followSubId),
    ).toBe(false);
  });

  it('followDiscoveryFinishedWithoutList requires follow-sub EOSE on every relay', () => {
    const followSubId = 'timeline-test:follows';
    const active = [
      snapshot({
        url: 'relay-one.example',
        eoseBySub: { [followSubId]: true },
      }),
      snapshot({
        url: 'relay-two.example',
        eoseBySub: { [followSubId]: true },
      }),
    ];

    expect(
      followDiscoveryFinishedWithoutList(active, false, false, followSubId),
    ).toBe(true);
  });

  it('statusFromRelayState does not use unrelated EOSE for ready-empty', () => {
    const noteSubId = 'timeline-test:notes';
    const active = [
      snapshot({
        url: 'relay-one.example',
        eoseBySub: { 'timeline-test:metadata': true },
      }),
    ];

    const status = statusFromRelayState(
      active,
      [],
      false,
      false,
      noteSubId,
    );
    expect(status).toBe('loading-follows');
    expect(relaySnapshotCounts(active, noteSubId).eoseRelays).toBe(0);
  });
});

