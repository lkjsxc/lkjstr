import { describe, expect, it } from 'vitest';
import {
  clearProfileCacheForTests,
  getProfile,
  setProfile,
} from '../../../src/lib/identity/profile-cache';

describe('profile cache', () => {
  it('does not replace newer metadata with older metadata', () => {
    clearProfileCacheForTests();
    const pubkey = 'a'.repeat(64);
    setProfile({
      pubkey,
      displayName: 'new',
      name: null,
      nip05: null,
      avatarUrl: null,
      updatedAt: 2000,
    });
    setProfile({
      pubkey,
      displayName: 'old',
      name: null,
      nip05: null,
      avatarUrl: null,
      updatedAt: 1000,
    });
    expect(getProfile(pubkey)?.displayName).toBe('new');
  });
});
