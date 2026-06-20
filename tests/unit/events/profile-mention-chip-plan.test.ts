import { describe, expect, it } from 'vitest';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import { planProfileMentionChip } from '../../../src/lib/components/events/profile-mention-chip-plan';

describe('profile mention chip plan', () => {
  it('renders retained profile mentions as static chips without real openers', () => {
    expect(
      planProfileMentionChip({
        text: '@Display',
        rawText: 'nostr:npub1raw',
        profile: undefined,
        openProfile: undefined,
      }),
    ).toEqual({
      canOpenProfile: false,
      title: 'nostr:npub1raw',
      text: '@Display',
      emojis: [],
    });
  });

  it('keeps opener and custom emoji presentation data from real inputs', () => {
    const emojis = [
      {
        shortcode: 'party',
        url: 'https://example.com/party.png',
        address: `30030:${'a'.repeat(64)}:party`,
      },
    ];

    expect(
      planProfileMentionChip({
        text: ':party:',
        rawText: 'nostr:npub1emoji',
        profile: profile('b'.repeat(64), emojis),
        openProfile: () => undefined,
      }),
    ).toEqual({
      canOpenProfile: true,
      title: 'nostr:npub1emoji',
      text: ':party:',
      emojis,
    });
  });
});

function profile(
  pubkey: string,
  customEmojis: ProfileSummary['customEmojis'],
): ProfileSummary {
  return {
    pubkey,
    displayName: 'Display',
    name: null,
    nip05: null,
    avatarUrl: null,
    updatedAt: 1,
    customEmojis,
  };
}
