import { describe, expect, it } from 'vitest';
import {
  followingCount,
  normalizedProfileWebsite,
  relaySetsCopyJson,
} from '../../../src/lib/profile/profile-links';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('profile links and copy helpers', () => {
  it('normalizes safe website values', () => {
    expect(normalizedProfileWebsite('example.com')).toBe(
      'https://example.com/',
    );
    expect(normalizedProfileWebsite('http://example.com/a')).toBe(
      'http://example.com/a',
    );
    expect(normalizedProfileWebsite('javascript:alert(1)')).toBe('');
  });

  it('counts unique followed pubkeys from kind 3 tags', () => {
    const pubkey = 'a'.repeat(64);
    expect(
      followingCount({
        ...event(),
        kind: 3,
        tags: [
          ['p', pubkey],
          ['p', pubkey],
          ['p', 'bad'],
        ],
      }),
    ).toBe(1);
  });

  it('copies registered relay set JSON with default marker', () => {
    const json = JSON.parse(
      relaySetsCopyJson([
        {
          id: 'default',
          name: 'Default',
          isDefault: true,
          seeded: true,
          updatedAt: 1,
          relays: [
            {
              url: 'wss://relay.example',
              label: 'Relay',
              enabled: true,
              read: true,
              write: false,
              state: 'idle',
              updatedAt: 1,
              health: { attempts: 0, successes: 0, failures: 0 },
            },
          ],
        },
      ]),
    );
    expect(json[0]).toMatchObject({ id: 'default', default: true });
    expect(json[0].relays[0]).toMatchObject({ read: true, write: false });
  });
});

function event(): NostrEvent {
  return {
    id: '0'.repeat(64),
    pubkey: '1'.repeat(64),
    created_at: 1,
    kind: 1,
    tags: [],
    content: '',
    sig: '2'.repeat(128),
  };
}
