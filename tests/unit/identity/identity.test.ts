import { describe, expect, it } from 'vitest';
import { avatarColor, initials } from '../../../src/lib/identity/avatar';
import { shortNpub } from '../../../src/lib/identity/display-name';
import { identityDisplay } from '../../../src/lib/identity/identity';

describe('identity display', () => {
  const pubkey = 'a'.repeat(64);

  it('uses display names and fallback npubs', () => {
    expect(identityDisplay(pubkey).title).toBe(shortNpub(pubkey));
    expect(
      identityDisplay(pubkey, {
        pubkey,
        displayName: 'Ada',
        name: null,
        nip05: 'ada.example',
        avatarUrl: null,
        updatedAt: Date.now(),
      }),
    ).toMatchObject({ title: 'Ada', subtitle: 'ada.example' });
  });

  it('generates stable fallback avatars', () => {
    expect(avatarColor(pubkey)).toBe('#aaaaaa');
    expect(initials('Ada Lovelace')).toBe('AL');
  });
});
