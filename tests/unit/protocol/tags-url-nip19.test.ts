import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { describe, expect, it } from 'vitest';
import {
  decodeEntity,
  encodeNote,
  encodeNpub,
  indexTags,
  normalizeRelayUrl,
  replyParent,
  replyRoot,
} from '../../../src/lib/protocol';

const event = finalizeEvent(
  {
    created_at: 100,
    kind: 1,
    tags: [
      ['e', '1'.repeat(64), 'wss://relay.example', 'root'],
      ['e', '2'.repeat(64), 'wss://relay.example', 'reply'],
      ['p', '3'.repeat(64)],
      ['t', 'workspace'],
    ],
    content: 'tag test',
  },
  generateSecretKey(),
);

describe('tags, relay URLs, and NIP-19', () => {
  it('extracts indexed tags and reply markers', () => {
    expect(indexTags(event)).toMatchObject({
      events: ['1'.repeat(64), '2'.repeat(64)],
      topics: ['workspace'],
    });
    expect(replyRoot(event)).toBe('1'.repeat(64));
    expect(replyParent(event)).toBe('2'.repeat(64));
  });

  it('normalizes relay URLs', () => {
    expect(normalizeRelayUrl('relay.example/')).toBe('wss://relay.example/');
    expect(normalizeRelayUrl('https://relay.example/path/?b=2&a=1#x')).toBe(
      'wss://relay.example/path?a=1&b=2',
    );
    expect(normalizeRelayUrl('ftp://relay.example')).toBeUndefined();
  });

  it('wraps NIP-19 entities', () => {
    const npub = encodeNpub(event.pubkey);
    const note = encodeNote(event.id);
    expect(decodeEntity(npub)).toMatchObject({
      type: 'npub',
      data: event.pubkey,
    });
    expect(decodeEntity(note)).toMatchObject({ type: 'note', data: event.id });
    expect(decodeEntity('not-an-entity')).toBeUndefined();
  });
});
