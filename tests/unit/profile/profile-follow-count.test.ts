import { describe, expect, it } from 'vitest';
import {
  followCountKnown,
  followCountLabel,
  profileFollowListStatus,
} from '../../../src/lib/profile/follow-count-state';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('profile follow count state', () => {
  it('does not render unknown follow lists as zero', () => {
    expect(followCountKnown('loading-cache')).toBe(false);
    expect(followCountLabel({ count: 0, status: 'discovering-relays' })).toBe(
      'Calculating following...',
    );
    expect(followCountLabel({ count: 0, status: 'incomplete' })).toBe(
      'Following incomplete',
    );
  });

  it('distinguishes known empty from unavailable', () => {
    expect(profileFollowListStatus(event([]))).toBe('known-empty');
    expect(followCountLabel({ count: 0, status: 'known-empty' })).toBe(
      '0 following',
    );
    expect(followCountLabel({ count: 0, status: 'unavailable' })).toBe(
      'Following unavailable',
    );
  });

  it('dedupes valid pubkeys for known counts', () => {
    const followList = event([
      ['p', 'a'.repeat(64)],
      ['p', 'a'.repeat(64)],
      ['p', 'bad'],
      ['p', 'b'.repeat(64)],
    ]);
    expect(profileFollowListStatus(followList)).toBe('known');
    expect(followCountLabel({ count: 2, status: 'known' })).toBe('2 following');
  });
});

function event(tags: string[][]): NostrEvent {
  return {
    id: '1'.repeat(64),
    pubkey: '2'.repeat(64),
    sig: '3'.repeat(128),
    kind: 3,
    tags,
    created_at: 1,
    content: '',
  };
}
