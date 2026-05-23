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
});
