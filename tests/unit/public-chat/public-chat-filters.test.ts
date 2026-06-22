import { describe, expect, it } from 'vitest';
import {
  channelDiscoveryPlan,
  channelMessagesPlan,
  channelMetadataPlan,
  ownHidePlan,
  ownMutePlan,
} from '../../../src/lib/public-chat/public-chat-filters';
import type { PublicChatChannel } from '../../../src/lib/public-chat/public-chat-types';
import type {
  RelayRecord,
  RelaySet,
} from '../../../src/lib/relays/relay-store';

describe('public chat read plans', () => {
  it('labels read purposes truthfully', () => {
    expect(channelDiscoveryPlan(relaySets()).purpose).toBe('feed');
    expect(channelMetadataPlan(relaySets(), [channel()])?.purpose).toBe(
      'metadata',
    );
    expect(channelMessagesPlan(relaySets(), channel()).purpose).toBe('feed');
    expect(ownHidePlan(relaySets(), 'me', ['message'])?.purpose).toBe(
      'event-lookup',
    );
    expect(ownMutePlan(relaySets(), 'me', ['author'])?.purpose).toBe(
      'event-lookup',
    );
  });
});

function channel(): PublicChatChannel {
  return {
    id: 'channel',
    creatorPubkey: 'creator',
    createdAt: 1,
    metadata: { relays: [] },
    relayHints: [],
  };
}

function relaySets(): RelaySet[] {
  return [
    {
      id: 'user',
      name: 'User relays',
      purpose: 'user',
      seeded: false,
      updatedAt: 1,
      relays: [relay('wss://relay.example/')],
    },
  ];
}

function relay(url: string): RelayRecord {
  return {
    url,
    label: url,
    enabled: true,
    read: true,
    write: true,
    state: 'idle',
    updatedAt: 1,
    health: { attempts: 0, successes: 0, failures: 0 },
  };
}
