import { describe, expect, it } from 'vitest';
import { parseCustomRequest } from '../../../src/lib/custom-request/parse';

describe('custom request parsing', () => {
  it('accepts a single filter object', () => {
    expect(parseCustomRequest('{"kinds":[1],"limit":2}')).toMatchObject({
      filters: [{ kinds: [1], limit: 2 }],
      relays: [],
    });
  });

  it('accepts filter arrays and request relays', () => {
    const parsed = parseCustomRequest(
      '{"relays":["relay.example"],"filters":[{"kinds":[1]}]}',
    );
    expect(parsed.filters).toEqual([{ kinds: [1] }]);
    expect(parsed.relays).toEqual(['wss://relay.example/']);
  });

  it('accepts REQ arrays', () => {
    const request = JSON.stringify([
      'REQ',
      'sub',
      { authors: ['a'.repeat(64)] },
    ]);
    expect(parseCustomRequest(request)).toMatchObject({ subId: 'sub' });
  });

  it('rejects invalid filters before reads', () => {
    expect(() => parseCustomRequest('{"kinds":["1"]}')).toThrow(
      'Filter is invalid.',
    );
  });

  it('rejects oversized JSON before parsing', () => {
    expect(() => parseCustomRequest(' '.repeat(64 * 1024 + 1))).toThrow(
      'Request JSON exceeds 65536 bytes.',
    );
  });

  it('enforces request caps and clamps relay limits', () => {
    expect(
      parseCustomRequest(
        JSON.stringify({ filters: [{ kinds: [1], limit: 999 }] }),
      ).filters[0]?.limit,
    ).toBe(500);
    expect(() =>
      parseCustomRequest(JSON.stringify(Array.from({ length: 9 }, () => ({})))),
    ).toThrow('At most 8 filters are allowed.');
    expect(() =>
      parseCustomRequest(
        JSON.stringify({
          relays: Array.from({ length: 33 }, () => 'relay.example'),
          filters: [{}],
        }),
      ),
    ).toThrow('At most 32 relays are allowed.');
  });
});
