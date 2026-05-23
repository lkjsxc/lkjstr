import { describe, expect, it } from 'vitest';
import { parseRelayMessageData } from '../../../src/lib/relays/relay-message-data';
import { maxRelayMessageBytes } from '../../../src/lib/relays/relay-message-size';

describe('relay message data', () => {
  it('parses messages above 64 KiB and below 512 KiB', () => {
    const data = JSON.stringify(['NOTICE', 'a'.repeat(70 * 1024)]);

    expect(data.length).toBeGreaterThan(64 * 1024);
    expect(parseRelayMessageData(data)).toMatchObject({
      ok: true,
      message: ['NOTICE', expect.any(String)],
    });
  });

  it('rejects oversized frames before JSON parsing', () => {
    const data = 'x'.repeat(maxRelayMessageBytes + 1);

    expect(parseRelayMessageData(data)).toEqual({
      ok: false,
      message: `relay message too large: ${maxRelayMessageBytes + 1} bytes exceeds ${maxRelayMessageBytes} byte limit`,
    });
  });

  it('counts UTF-8 bytes instead of JavaScript string length', () => {
    const data = `["NOTICE","${'€'.repeat(180 * 1024)}"]`;
    const result = parseRelayMessageData(data);

    expect(data.length).toBeLessThan(maxRelayMessageBytes);
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining('relay message too large'),
    });
  });
});
