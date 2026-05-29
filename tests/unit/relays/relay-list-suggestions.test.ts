import { beforeEach, describe, expect, it } from 'vitest';
import {
  importRelayListSuggestion,
  parseRelayListSuggestions,
  relayListSuggestionsForAccount,
  storeRelayListSuggestionsFromEvent,
} from '../../../src/lib/relays/relay-list-suggestions';
import {
  listRelaySets,
  saveRelaySets,
  type RelaySet,
} from '../../../src/lib/relays/relay-store';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('relay list suggestions', () => {
  beforeEach(async () => {
    await saveRelaySets([relaySet([])]);
  });

  it('parses NIP-65 read, write, both, duplicate, and malformed tags', () => {
    const parsed = parseRelayListSuggestions(
      event([
        ['r', 'relay.example'],
        ['r', 'wss://write.example', 'write'],
        ['r', 'wss://read.example', 'read'],
        ['r', 'wss://read.example', 'write'],
        ['r', 'ftp://bad.example'],
        ['p', 'ignored'],
      ]),
    );

    expect(parsed).toEqual([
      { relayUrl: 'wss://read.example/', read: true, write: true },
      { relayUrl: 'wss://relay.example/', read: true, write: true },
      { relayUrl: 'wss://write.example/', read: false, write: true },
    ]);
  });

  it('stores suggestions per account pubkey', async () => {
    await storeRelayListSuggestionsFromEvent(
      event([['r', 'wss://relay.example', 'read']]),
    );

    await expect(
      relayListSuggestionsForAccount('2'.repeat(64)),
    ).resolves.toEqual([
      expect.objectContaining({
        relayUrl: 'wss://relay.example/',
        read: true,
        write: false,
      }),
    ]);
    await expect(
      relayListSuggestionsForAccount('3'.repeat(64)),
    ).resolves.toEqual([]);
  });

  it('imports explicitly without overwriting existing disabled relays', async () => {
    await saveRelaySets([
      relaySet([
        {
          url: 'wss://relay.example/',
          label: 'relay.example',
          enabled: false,
          read: false,
          write: false,
          state: 'idle',
          updatedAt: 1,
          health: { attempts: 0, successes: 0, failures: 0 },
        },
      ]),
    ]);

    await importRelayListSuggestion('set', {
      relayUrl: 'wss://relay.example/',
      read: true,
      write: true,
    });
    await importRelayListSuggestion('set', {
      relayUrl: 'wss://new.example/',
      read: true,
      write: false,
    });

    const [set] = await listRelaySets();
    expect(set?.relays).toEqual([
      expect.objectContaining({
        url: 'wss://relay.example/',
        enabled: false,
        read: false,
        write: false,
      }),
      expect.objectContaining({
        url: 'wss://new.example/',
        enabled: true,
        read: true,
        write: false,
      }),
    ]);
  });
});

function relaySet(relays: RelaySet['relays']): RelaySet {
  return {
    id: 'set',
    name: 'Set',
    purpose: 'user',
    seeded: false,
    relays,
    updatedAt: Date.now(),
  };
}

function event(tags: readonly string[][]): NostrEvent {
  return {
    id: '1'.repeat(64),
    sig: '1'.repeat(128),
    pubkey: '2'.repeat(64),
    kind: 10002,
    tags,
    created_at: 100,
    content: '',
  };
}
