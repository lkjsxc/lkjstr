import { describe, expect, it } from 'vitest';
import { parseRelayMessageData } from '../../../src/lib/relays/relay-message-data';

describe('relay message data', () => {
  it('parses valid text relay messages above 512 KiB', () => {
    const data = JSON.stringify(['NOTICE', 'a'.repeat(520 * 1024)]);

    expect(data.length).toBeGreaterThan(512 * 1024);
    expect(parseRelayMessageData(data)).toMatchObject({
      ok: true,
      message: ['NOTICE', expect.any(String)],
    });
  });

  it('fails invalid large text by JSON parsing, not size', () => {
    const data = 'x'.repeat(520 * 1024);

    expect(parseRelayMessageData(data)).toEqual({
      ok: false,
      message: 'relay message is not valid JSON',
    });
  });

  it('parses large UTF-8 text below the app byte cap', () => {
    const data = `["NOTICE","${'€'.repeat(180 * 1024)}"]`;
    const result = parseRelayMessageData(data);

    expect(result).toMatchObject({
      ok: true,
      message: ['NOTICE', expect.any(String)],
    });
  });

  it('rejects text frames above the app byte cap before JSON parsing', () => {
    const data = 'x'.repeat(1_048_577);

    expect(parseRelayMessageData(data)).toEqual({
      ok: false,
      message: 'relay text frame exceeds 1048576 bytes (1048577)',
    });
  });

  it('rejects oversized event content and tags', () => {
    expect(
      parseRelayMessageData(
        JSON.stringify([
          'EVENT',
          'sub',
          event({ content: 'a'.repeat(262_145) }),
        ]),
      ),
    ).toEqual({
      ok: false,
      message: 'content exceeds 262144 bytes',
    });
    expect(
      parseRelayMessageData(
        JSON.stringify([
          'EVENT',
          'sub',
          event({ tags: Array.from({ length: 513 }, () => ['p', 'a']) }),
        ]),
      ),
    ).toEqual({
      ok: false,
      message: 'tags exceed 512 entries',
    });
  });

  it('rejects unsupported non-text frames with measured bytes', () => {
    expect(parseRelayMessageData(new Uint8Array([1, 2, 3]))).toEqual({
      ok: false,
      message: 'unsupported non-text relay frame: 3 bytes',
    });
  });
});

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: '1'.repeat(64),
    pubkey: '2'.repeat(64),
    created_at: 1,
    kind: 1,
    tags: [],
    content: 'hello',
    sig: '3'.repeat(128),
    ...overrides,
  };
}
