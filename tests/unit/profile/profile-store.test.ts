import { describe, expect, it } from 'vitest';
import { clearEventRepositoryForTests } from '../../../src/lib/events/repository';
import type { NostrEvent } from '../../../src/lib/protocol';
import {
  cachedProfileNotes,
  storeProfileEvent,
} from '../../../src/lib/profile/profile-store';
import { loadInitialProfilePage } from '../../../src/lib/profile/profile-runtime-initial';
import {
  draftFromMetadata,
  mergeProfileMetadataDraft,
  validateProfileMetadataDraft,
} from '../../../src/lib/profile/profile-metadata-draft';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

describe('profile store', () => {
  it('preserves relay provenance for cached profile notes', async () => {
    clearEventRepositoryForTests();
    const pubkey = 'a'.repeat(64);
    const event = note(pubkey, 'b'.repeat(64));
    await storeProfileEvent(event, ['wss://relay.example/']);
    const [cached] = await cachedProfileNotes(pubkey);
    expect(cached?.event.id).toBe(event.id);
    expect(cached?.relays).toEqual(['wss://relay.example/']);
  });

  it('stores initial profile post relay results', async () => {
    clearEventRepositoryForTests();
    const pubkey = 'a'.repeat(64);
    const event = note(pubkey, 'd'.repeat(64));

    await loadInitialProfilePage({
      posts: [],
      profile: null,
      relays: ['wss://relay.example/'],
      pubkey,
      subId: 'profile-test',
      pageSize: 10,
      subscriptions: {
        readPage: async () => [],
        readPageDetailed: async (request: RelayReadRequest) =>
          detailed(
            request.key.includes(':posts')
              ? [{ event, relay: request.relays[0] ?? '', subId: request.key }]
              : [],
            request,
          ),
      } as unknown as RelaySubscriptionManager,
    });

    const [cached] = await cachedProfileNotes(pubkey);
    expect(cached?.event.id).toBe(event.id);
    expect(cached?.relays).toEqual(['wss://relay.example/']);
  });

  it('merges profile drafts while preserving unknown keys and lud06', () => {
    const base = { name: 'old', lud06: 'lnurl', extra: true };
    const draft = { ...draftFromMetadata(base), name: '', about: 'new' };
    expect(mergeProfileMetadataDraft(base, draft)).toEqual({
      about: 'new',
      lud06: 'lnurl',
      extra: true,
    });
  });

  it('validates HTTPS profile URLs', () => {
    const draft = { ...draftFromMetadata({}), picture: 'http://example.test' };
    expect(validateProfileMetadataDraft(draft)).toMatch(/HTTPS/);
  });
});

function note(pubkey: string, id: string): NostrEvent {
  return {
    id,
    pubkey,
    created_at: 10,
    kind: 1,
    tags: [],
    content: 'profile note',
    sig: 'c'.repeat(128),
  };
}

function detailed(
  events: readonly PoolEvent[],
  request: RelayReadRequest,
): ReadPageResult {
  return {
    events: [...events],
    statuses: request.relays.map((relay) => ({
      relay,
      eose: true,
      timeout: false,
      closed: false,
      auth: false,
      socketClosed: false,
      socketError: false,
      durationMs: 1,
      candidateCount: events.length,
      finalCount: events.length,
    })),
  };
}
