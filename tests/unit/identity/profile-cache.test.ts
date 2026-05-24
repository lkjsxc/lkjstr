import { describe, expect, it } from 'vitest';
import {
  clearProfileCacheForTests,
  getProfile,
  profileCacheSizeForTests,
  profileFromMetadataEvent,
  setProfile,
} from '../../../src/lib/identity/profile-cache';
import type { NostrEvent } from '../../../src/lib/protocol';
import { storeTimelineProfile } from '../../../src/lib/timeline/timeline-profiles';

describe('profile cache', () => {
  it('does not replace newer metadata with older metadata', () => {
    clearProfileCacheForTests();
    const pubkey = 'a'.repeat(64);
    const newer = setProfile({
      pubkey,
      displayName: 'new',
      name: null,
      nip05: null,
      avatarUrl: null,
      updatedAt: 2000,
    });
    const effective = setProfile({
      pubkey,
      displayName: 'old',
      name: null,
      nip05: null,
      avatarUrl: null,
      updatedAt: 1000,
    });
    expect(getProfile(pubkey)?.displayName).toBe('new');
    expect(newer.displayName).toBe('new');
    expect(effective.displayName).toBe('new');
  });

  it('returns the effective profile when timeline metadata is stale', async () => {
    clearProfileCacheForTests();
    const pubkey = 'b'.repeat(64);
    setProfile(profileFromMetadataEvent(metadata(pubkey, 20, 'new')));
    const effective = await storeTimelineProfile(metadata(pubkey, 10, 'old'));
    expect(effective.displayName).toBe('new');
    expect(getProfile(pubkey)?.displayName).toBe('new');
  });

  it('bounds cached profile summaries', () => {
    clearProfileCacheForTests();
    for (let index = 0; index < 1001; index += 1) {
      setProfile({
        pubkey: `${index}`.padStart(64, '0'),
        displayName: `name ${index}`,
        name: null,
        nip05: null,
        avatarUrl: null,
        updatedAt: index,
      });
    }

    expect(profileCacheSizeForTests()).toBe(1000);
    expect(getProfile('0'.repeat(64))).toBeUndefined();
    expect(getProfile('1000'.padStart(64, '0'))?.displayName).toBe('name 1000');
  });
});

function metadata(pubkey: string, createdAt: number, name: string): NostrEvent {
  return {
    id: `${createdAt}`.padStart(64, '0'),
    pubkey,
    created_at: createdAt,
    kind: 0,
    tags: [],
    content: JSON.stringify({ display_name: name }),
    sig: 'f'.repeat(128),
  };
}
