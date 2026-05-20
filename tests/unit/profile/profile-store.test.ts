import { describe, expect, it } from 'vitest';
import { clearEventRepositoryForTests } from '../../../src/lib/events/repository';
import type { NostrEvent } from '../../../src/lib/protocol';
import {
  cachedProfileNotes,
  storeProfileEvent,
} from '../../../src/lib/profile/profile-store';
import {
  draftFromMetadata,
  mergeProfileMetadataDraft,
  validateProfileMetadataDraft,
} from '../../../src/lib/profile/profile-metadata-draft';

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
