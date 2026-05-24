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

  it('parses large UTF-8 text without an app byte cap', () => {
    const data = `["NOTICE","${'€'.repeat(180 * 1024)}"]`;
    const result = parseRelayMessageData(data);

    expect(result).toMatchObject({
      ok: true,
      message: ['NOTICE', expect.any(String)],
    });
  });

  it('rejects unsupported non-text frames with measured bytes', () => {
    expect(parseRelayMessageData(new Uint8Array([1, 2, 3]))).toEqual({
      ok: false,
      message: 'unsupported non-text relay frame: 3 bytes',
    });
  });
});
