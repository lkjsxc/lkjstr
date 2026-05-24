import { describe, expect, it } from 'vitest';
import {
  followListCopyJson,
  followingCount,
  normalizedProfileWebsite,
  relaySetsCopyJson,
  tokenizeProfileText,
} from '../../../src/lib/profile/profile-links';
import {
  decodeEntity,
  encodeNprofile,
  type ProfilePointer,
} from '../../../src/lib/protocol/nip19';
import { setDefaultRelaySetId } from '../../../src/lib/relays/relay-store';
import { timelineRelays } from '../../../src/lib/timeline/timeline-subscription';
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

  it('tokenizes safe profile about URLs and custom emoji', () => {
    const tokens = tokenizeProfileText('See example.com and :party:', [
      { shortcode: 'party', url: 'https://emoji.example/party.png' },
    ]);
    expect(tokens).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'url', href: 'https://example.com/', text: 'example.com' },
      { type: 'text', text: ' and ' },
      {
        type: 'custom-emoji',
        shortcode: 'party',
        url: 'https://emoji.example/party.png',
        text: ':party:',
      },
    ]);
  });

  it('does not link unsafe profile about URL schemes', () => {
    expect(tokenizeProfileText('bad javascript://example.com')[0]).toEqual({
      type: 'text',
      text: 'bad javascript://example.com',
    });
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

  it('copies follow-list JSON or null', () => {
    expect(JSON.parse(followListCopyJson(undefined))).toBeNull();
    expect(JSON.parse(followListCopyJson({ ...event(), kind: 3 })).kind).toBe(
      3,
    );
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
    expect(json[0].relays[0]).toMatchObject({
      url: 'wss://relay.example/',
      enabled: true,
      read: true,
      write: false,
    });
  });

  it('builds nprofile relay hints from selected enabled read relays', () => {
    setDefaultRelaySetId('selected');
    const relays = timelineRelays([
      relaySet('other', ['wss://other.example']),
      {
        ...relaySet('selected', ['wss://read.example', 'wss://write.example']),
        relays: [
          relay('wss://read.example', true, true, false),
          relay('wss://write.example', true, false, true),
          relay('wss://disabled.example', false, true, true),
        ],
      },
    ]);
    const decoded = decodeNprofile(
      encodeNprofile({ pubkey: 'a'.repeat(64), relays }),
    );
    expect(decoded.relays).toEqual(['wss://read.example/']);
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

function relaySet(id: string, urls: string[]) {
  return {
    id,
    name: id,
    isDefault: id === 'selected',
    seeded: false,
    updatedAt: 1,
    relays: urls.map((url) => relay(url)),
  };
}

function relay(url: string, enabled = true, read = true, write = true) {
  return {
    url,
    label: url,
    enabled,
    read,
    write,
    state: 'idle' as const,
    updatedAt: 1,
    health: { attempts: 0, successes: 0, failures: 0 },
  };
}

function decodeNprofile(value: string): ProfilePointer {
  const decoded = decodeEntity(value);
  if (!decoded || decoded.type !== 'nprofile')
    throw new Error('not an nprofile');
  return decoded.data as ProfilePointer;
}
