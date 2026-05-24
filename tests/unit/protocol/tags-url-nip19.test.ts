import { finalizeEvent, generateSecretKey } from '../../../src/lib/protocol';
import { describe, expect, it } from 'vitest';
import {
  decodeEntity,
  encodeNote,
  encodeNpub,
  eventReferences,
  indexTags,
  kinds,
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
      quotes: [],
      addresses: [],
      topics: ['workspace'],
    });
    expect(replyRoot(event)).toBe('1'.repeat(64));
    expect(replyParent(event)).toBe('2'.repeat(64));
  });

  it('parses event embed references', () => {
    const quoted = finalizeEvent(
      {
        created_at: 101,
        kind: 1,
        tags: [['q', '4'.repeat(64), 'wss://quote.example']],
        content: `nostr:${encodeNote('5'.repeat(64))}`,
      },
      generateSecretKey(),
    );
    expect(eventReferences(quoted)).toEqual([
      {
        kind: 'quote',
        id: '4'.repeat(64),
        relays: ['wss://quote.example'],
        source: 'q',
      },
      { kind: 'nostr-event', id: '5'.repeat(64), source: 'content' },
    ]);
  });

  it('dedupes quote and content references by event id', () => {
    const id = '6'.repeat(64);
    const quoted = finalizeEvent(
      {
        created_at: 101,
        kind: 1,
        tags: [['q', id]],
        content: `nostr:${encodeNote(id)}`,
      },
      generateSecretKey(),
    );
    expect(eventReferences(quoted)).toEqual([
      { kind: 'quote', id, source: 'q' },
    ]);
  });

  it('uses action targets instead of reply roots for action events', () => {
    const target = '7'.repeat(64);
    const root = '8'.repeat(64);
    const reaction = finalizeEvent(
      {
        created_at: 102,
        kind: kinds.reaction,
        tags: [
          ['e', root, '', 'root'],
          ['e', target],
        ],
        content: '+',
      },
      generateSecretKey(),
    );
    expect(eventReferences(reaction)).toEqual([
      { kind: 'reaction', id: target, source: 'reaction' },
    ]);
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
