import { describe, expect, it, beforeEach } from 'vitest';
import { generateSecretKey, getPublicKey } from '../../../src/lib/protocol';
import { buildPreferredRelayGroups } from '../../../src/lib/timeline/follow-list-sync-groups';
import {
  clearRelayRoutesForTests,
  saveAuthorRelayRoute,
  saveRouteBlock,
} from '../../../src/lib/relays/relay-route-store';

beforeEach(() => clearRelayRoutesForTests());

describe('follow-list sync relay groups', () => {
  it('uses selected, NIP-65, and provenance routes while excluding disabled relays', async () => {
    const target = getPublicKey(generateSecretKey());
    await saveAuthorRelayRoute({
      authorPubkey: target,
      relayUrl: 'wss://nip65.example/',
      source: 'nip65',
      purpose: 'read',
    });
    await saveAuthorRelayRoute({
      authorPubkey: target,
      relayUrl: 'wss://hint.example/',
      source: 'event-hint',
      purpose: 'read',
    });
    await saveRouteBlock('wss://blocked.example/', 'user-disabled');

    const groups = await buildPreferredRelayGroups({
      activePubkey: target,
      selectedRelays: ['wss://selected.example/', 'wss://blocked.example/'],
      allowDiscoveryFallback: false,
    });

    expect(groups.selected).toEqual(['wss://selected.example/']);
    expect(groups.nip65).toEqual(['wss://nip65.example/']);
    expect(groups.provenance).toEqual(['wss://hint.example/']);
    expect(groups.discovery).toEqual([]);
    expect(JSON.stringify(groups)).not.toContain('blocked.example');
  });
});
