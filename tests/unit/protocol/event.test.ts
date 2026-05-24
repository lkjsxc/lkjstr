import { finalizeEvent, generateSecretKey } from '../../../src/lib/protocol';
import { describe, expect, it } from 'vitest';
import {
  computeEventId,
  parseNostrEvent,
  serializeEvent,
  verifyEvent,
} from '../../../src/lib/protocol';

const secret = generateSecretKey();
const event = finalizeEvent(
  {
    created_at: 1_700_000_000,
    kind: 1,
    tags: [['t', 'nostr']],
    content: 'hello lkjstr',
  },
  secret,
);

describe('protocol events', () => {
  it('parses a valid event', () => {
    const result = parseNostrEvent(event);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.id).toBe(event.id);
  });

  it('rejects malformed fields', () => {
    expect(parseNostrEvent({ ...event, pubkey: 'bad' })).toMatchObject({
      ok: false,
      code: 'bad_field',
    });
    expect(parseNostrEvent({ ...event, tags: [['p', 1]] })).toMatchObject({
      ok: false,
      code: 'bad_tag',
    });
  });

  it('serializes and hashes using NIP-01 order', () => {
    const serialized = serializeEvent(event);
    expect(serialized).toBe(
      JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content,
      ]),
    );
    expect(computeEventId(event)).toBe(event.id);
  });

  it('verifies signatures and detects mutations', () => {
    expect(verifyEvent(event).ok).toBe(true);
    expect(verifyEvent({ ...event, content: 'changed' })).toMatchObject({
      ok: false,
      code: 'id_mismatch',
    });
  });
});
