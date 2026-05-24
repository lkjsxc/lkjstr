import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../../src/lib/protocol';
import { describe, expect, it } from 'vitest';
import { contentTokens } from '../../../src/lib/events/content-tokens';
import {
  encodeNote,
  encodeNprofile,
  encodeNpub,
} from '../../../src/lib/protocol/nip19';

describe('content tokens', () => {
  it('hides embedded media urls but keeps normal links visible', () => {
    const tokens = contentTokens(
      event('see https://example.com/a.jpg and https://example.com/page'),
    );
    expect(tokens).toEqual([
      { type: 'text', text: 'see  and ' },
      {
        type: 'url',
        url: 'https://example.com/page',
        text: 'https://example.com/page',
      },
    ]);
  });

  it('decodes profile and event mentions', () => {
    const pubkey = getPublicKey(generateSecretKey());
    const note = '1'.repeat(64);
    const npub = `nostr:${encodeNpub(pubkey)}`;
    const nprofile = `nostr:${encodeNprofile({
      pubkey,
      relays: ['wss://relay.example'],
    })}`;
    const encodedNote = `nostr:${encodeNote(note)}`;
    const tokens = contentTokens(event(`${npub} ${nprofile} ${encodedNote}`));

    expect(tokens).toMatchObject([
      { type: 'profile', pubkey, text: npub, rawText: npub, relays: [] },
      { type: 'text', text: ' ' },
      {
        type: 'profile',
        pubkey,
        text: nprofile,
        rawText: nprofile,
        relays: ['wss://relay.example'],
      },
      { type: 'text', text: ' ' },
      {
        type: 'event',
        eventId: note,
        text: `event:${note.slice(0, 8)}`,
        rawText: encodedNote,
        relays: [],
      },
    ]);
  });

  it('renders profile labels and hides expanded event mentions', () => {
    const pubkey = getPublicKey(generateSecretKey());
    const note = '2'.repeat(64);
    const npub = `nostr:${encodeNpub(pubkey)}`;
    const encodedNote = `nostr:${encodeNote(note)}`;
    const tokens = contentTokens(
      event(`${npub} ${encodedNote}`),
      { [pubkey]: profile(pubkey, 'Ada') },
      new Set([note]),
    );

    expect(tokens).toEqual([
      {
        type: 'profile',
        pubkey,
        text: '@Ada',
        rawText: npub,
        relays: [],
      },
      { type: 'text', text: ' ' },
    ]);
  });

  it('renders matching custom emoji and leaves unknown shortcode text', () => {
    const emojiEvent = {
      ...event('Hi :party-1: and :missing:'),
      tags: [['emoji', 'party-1', 'https://emoji.example/party.png']],
    };
    expect(contentTokens(emojiEvent, {}, new Set())).toEqual([
      { type: 'text', text: 'Hi ' },
      {
        type: 'custom-emoji',
        shortcode: 'party-1',
        url: 'https://emoji.example/party.png',
        text: ':party-1:',
      },
      { type: 'text', text: ' and :missing:' },
    ]);
  });

  it('keeps punctuation outside emoji and urls', () => {
    const emojiEvent = {
      ...event('Look :party:, https://example.com/page.'),
      tags: [['emoji', 'party', 'https://emoji.example/party.png']],
    };
    expect(contentTokens(emojiEvent).at(1)).toMatchObject({
      type: 'custom-emoji',
      text: ':party:',
    });
    expect(contentTokens(emojiEvent).at(2)).toEqual({
      type: 'text',
      text: ', ',
    });
    expect(contentTokens(emojiEvent).at(3)).toMatchObject({
      type: 'url',
      text: 'https://example.com/page',
    });
    expect(contentTokens(emojiEvent).at(4)).toEqual({
      type: 'text',
      text: '.',
    });
  });
});

function profile(pubkey: string, name: string) {
  return {
    pubkey,
    displayName: name,
    name: null,
    nip05: null,
    avatarUrl: null,
    updatedAt: 1,
  };
}

function event(content: string) {
  return finalizeEvent(
    {
      created_at: 1,
      kind: 1,
      tags: [],
      content,
    },
    generateSecretKey(),
  );
}
