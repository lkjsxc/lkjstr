import { finalizeEvent, generateSecretKey } from '../../../src/lib/protocol';
import { describe, expect, it } from 'vitest';
import {
  encodeClientMessage,
  parseClientMessage,
  parseRelayMessage,
} from '../../../src/lib/protocol';

const event = finalizeEvent(
  {
    created_at: 100,
    kind: 1,
    tags: [],
    content: 'message test',
  },
  generateSecretKey(),
);

describe('protocol messages', () => {
  it('encodes client messages', () => {
    expect(encodeClientMessage(['CLOSE', 'sub'])).toBe('["CLOSE","sub"]');
    expect(encodeClientMessage(['REQ', 'sub', { kinds: [1] }])).toBe(
      '["REQ","sub",{"kinds":[1]}]',
    );
  });

  it('parses client messages before send', () => {
    expect(parseClientMessage(['EVENT', event])).toMatchObject([
      'EVENT',
      { id: event.id },
    ]);
    expect(parseClientMessage(['REQ', 'sub', { '#t': ['nostr'] }])).toEqual([
      'REQ',
      'sub',
      { '#t': ['nostr'] },
    ]);
  });

  it('parses relay messages', () => {
    expect(
      parseRelayMessage(JSON.stringify(['EVENT', 'sub', event])),
    ).toMatchObject({ ok: true });
    expect(
      parseRelayMessage(JSON.stringify(['OK', event.id, true, 'saved'])),
    ).toMatchObject({ ok: true });
    expect(parseRelayMessage(JSON.stringify(['EOSE', 'sub']))).toMatchObject({
      ok: true,
    });
    expect(
      parseRelayMessage(JSON.stringify(['CLOSED', 'sub', 'limit: slow'])),
    ).toMatchObject({ ok: true });
    expect(
      parseRelayMessage(JSON.stringify(['NOTICE', 'hello'])),
    ).toMatchObject({ ok: true });
  });

  it('fails safely for malformed relay messages', () => {
    expect(parseRelayMessage('nope')).toMatchObject({
      ok: false,
      code: 'bad_json',
    });
    expect(
      parseRelayMessage(JSON.stringify(['EVENT', 'sub', { bad: true }])),
    ).toMatchObject({
      ok: false,
      code: 'bad_event',
    });
  });
});
