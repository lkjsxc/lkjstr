import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
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
      { type: 'profile', pubkey, text: npub, relays: [] },
      { type: 'text', text: ' ' },
      {
        type: 'profile',
        pubkey,
        text: nprofile,
        relays: ['wss://relay.example'],
      },
      { type: 'text', text: ' ' },
      { type: 'event', eventId: note, text: encodedNote, relays: [] },
    ]);
  });
});

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
