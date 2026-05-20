import { describe, expect, it } from 'vitest';
import {
  httpAuthEvent,
  kinds,
  parseNip96Server,
  parseNip96UploadResult,
  reactionTags,
  replyTags,
  repostKind,
  repostTags,
  zapRequestTags,
} from '../../../src/lib/protocol';
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
    ]);
    expect(
      reactionTags(event, { shortcode: 'party', url: 'https://x/party.png' }),
    ).toContainEqual(['emoji', 'party', 'https://x/party.png']);
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

  it('builds zap request tags', () => {
    const event = nostrEvent();
    expect(
      zapRequestTags({
        event,
        amountMsats: 21000,
        relays: ['wss://relay.example'],
      }),
    ).toEqual([
      ['amount', '21000'],
      ['relays', 'wss://relay.example'],
      ['e', event.id],
      ['p', event.pubkey],
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
