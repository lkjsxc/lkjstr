import { describe, expect, it } from 'vitest';
import {
  httpAuthEvent,
  nostrAuthorizationHeader,
  kinds,
  parseNip96Server,
  parseNip96UploadResult,
  reactionTags,
  replyTags,
  repostKind,
  repostTags,
  zapRequestTags,
  contentDerivedTags,
} from '../../../src/lib/protocol';
import { encodeNevent, encodeNprofile } from '../../../src/lib/protocol/nip19';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('event builders', () => {
  it('builds reply tags with root, reply, and pubkeys', () => {
    const event = nostrEvent({ tags: [['e', '1'.repeat(64), '', 'root']] });
    expect(replyTags(event)).toEqual([
      ['e', '1'.repeat(64), '', 'root'],
      ['e', event.id, '', 'reply'],
      ['p', event.pubkey],
    ]);
  });

  it('builds reaction and custom emoji tags', () => {
    const event = nostrEvent();
    expect(reactionTags(event)).toEqual([
      ['e', event.id],
      ['p', event.pubkey],
      ['k', '1'],
    ]);
    expect(
      reactionTags(event, {
        shortcode: 'party',
        url: 'https://x/party.png',
        address: `30030:${event.pubkey}:set`,
      }),
    ).toContainEqual([
      'emoji',
      'party',
      'https://x/party.png',
      `30030:${event.pubkey}:set`,
    ]);
  });

  it('builds repost kinds and generic k tags', () => {
    const note = nostrEvent({ kind: kinds.textNote });
    const metadata = nostrEvent({ kind: kinds.metadata });
    expect(repostKind(note)).toBe(kinds.repost);
    expect(repostKind(metadata)).toBe(kinds.genericRepost);
    expect(repostTags(metadata)).toContainEqual(['k', String(kinds.metadata)]);
  });

  it('builds NIP-98 auth and parses NIP-96 upload output', () => {
    expect(
      httpAuthEvent({
        pubkey: 'a'.repeat(64),
        url: 'https://media.example/upload',
        method: 'post',
        now: 10,
      }),
    ).toMatchObject({
      kind: kinds.httpAuth,
      tags: [
        ['u', 'https://media.example/upload'],
        ['method', 'POST'],
      ],
    });
    expect(parseNip96Server({ api_url: 'https://media.example/api' })).toEqual({
      apiUrl: 'https://media.example/api',
      delegatedToUrl: undefined,
    });
    expect(
      parseNip96UploadResult({
        nip94_event: {
          tags: [
            ['url', 'https://cdn.example/a.png'],
            ['m', 'image/png'],
          ],
        },
      })?.imeta,
    ).toEqual(['imeta', 'url https://cdn.example/a.png', 'm image/png']);
  });

  it('encodes NIP-98 auth headers as UTF-8 base64 without Buffer', () => {
    const globals = globalThis as typeof globalThis & { Buffer?: unknown };
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Buffer');
    Reflect.deleteProperty(globalThis, 'Buffer');
    try {
      const header = nostrAuthorizationHeader({
        kind: kinds.httpAuth,
        content: 'unicode snow 雪',
        tags: [['u', 'https://media.example/upload']],
      });
      expect(decodeNostrHeader(header)).toMatchObject({
        kind: kinds.httpAuth,
        content: 'unicode snow 雪',
      });
      expect(globals.Buffer).toBeUndefined();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'Buffer', descriptor);
    }
  });

  it('builds zap request tags', () => {
    const event = nostrEvent();
    expect(
      zapRequestTags({
        event,
        amountMsats: 21000,
        lnurl:
          'lnurl1dp68gurn8ghj7etcv9khqmr99e3k7mf0d3h82unvwqhhw6twvus8y6t0dc',
        relays: ['wss://relay.example'],
      }),
    ).toEqual([
      ['relays', 'wss://relay.example'],
      ['amount', '21000'],
      [
        'lnurl',
        'lnurl1dp68gurn8ghj7etcv9khqmr99e3k7mf0d3h82unvwqhhw6twvus8y6t0dc',
      ],
      ['e', event.id],
      ['p', event.pubkey],
      ['k', '1'],
    ]);
  });

  it('derives mention and used custom emoji tags from note content', () => {
    const pubkey = 'a'.repeat(64);
    const eventId = 'b'.repeat(64);
    const nprofile = encodeNprofile({
      pubkey,
      relays: ['wss://profiles.example'],
    });
    const nevent = encodeNevent({
      id: eventId,
      relays: ['wss://events.example'],
    });
    expect(
      contentDerivedTags(
        `hi nostr:${nprofile} nostr:${nevent} :party:`,
        [
          { shortcode: 'unused', url: 'https://x/unused.png' },
          {
            shortcode: 'party',
            url: 'https://x/party.png',
            address: `30030:${pubkey}:set`,
          },
        ],
        [['p', pubkey]],
      ),
    ).toEqual([
      ['p', pubkey, 'wss://profiles.example'],
      ['q', eventId, 'wss://events.example'],
      ['emoji', 'party', 'https://x/party.png', `30030:${pubkey}:set`],
    ]);
  });
});

function nostrEvent(patch: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: '0'.repeat(64),
    pubkey: 'f'.repeat(64),
    created_at: 1,
    kind: 1,
    tags: [],
    content: '',
    sig: 'a'.repeat(128),
    ...patch,
  };
}

function decodeNostrHeader(header: string): unknown {
  const bytes = Uint8Array.from(atob(header.slice('Nostr '.length)), (item) =>
    item.charCodeAt(0),
  );
  return JSON.parse(new TextDecoder().decode(bytes));
}
