import { describe, expect, it } from 'vitest';
import type { ContentToken } from '../../../src/lib/events/content-tokens';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import {
  contentTokenEventVisible,
  contentTokenProfileLabel,
  contentTokenRenderKey,
  contentTokenUrlLinkPlan,
  stopContentTokenLinkPropagation,
} from '../../../src/lib/components/events/content-token-plan';

describe('content token render plan', () => {
  it('keeps retained token keys stable by position and token type', () => {
    const token: ContentToken = {
      type: 'url',
      url: 'https://e.test',
      text: 'x',
    };
    expect(contentTokenRenderKey(token, 3)).toBe('3:url');
  });

  it('uses hydrated profile display names without inventing fallback profiles', () => {
    const pubkey = 'a'.repeat(64);
    expect(contentTokenProfileLabel(pubkey, 'nostr:npub1raw', undefined)).toBe(
      'nostr:npub1raw',
    );
    expect(
      contentTokenProfileLabel(pubkey, 'nostr:npub1raw', {
        [pubkey]: profile(pubkey),
      }),
    ).toBe('@Display');
  });

  it('suppresses event tokens already rendered by a surrounding reference', () => {
    expect(contentTokenEventVisible('event-a', undefined)).toBe(true);
    expect(contentTokenEventVisible('event-a', new Set(['event-b']))).toBe(
      true,
    );
    expect(contentTokenEventVisible('event-a', new Set(['event-a']))).toBe(
      false,
    );
  });

  it('keeps retained URL token links external and opener-safe', () => {
    expect(contentTokenUrlLinkPlan('https://example.com/a')).toEqual({
      href: 'https://example.com/a',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('keeps retained URL token links from opening the parent row', () => {
    let stopped = 0;

    stopContentTokenLinkPropagation({
      stopPropagation: () => (stopped += 1),
    });

    expect(stopped).toBe(1);
  });
});

function profile(pubkey: string): ProfileSummary {
  return {
    pubkey,
    displayName: 'Display',
    name: null,
    nip05: null,
    avatarUrl: null,
    updatedAt: 1,
  };
}
