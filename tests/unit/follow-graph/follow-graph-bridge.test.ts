import { describe, expect, it } from 'vitest';
import { decodeBridgeResponse } from '../../../src/lib/follow-graph/follow-graph-bridge';

describe('follow graph bridge', () => {
  it('decodes Rust follow-list summaries', () => {
    expect(
      decodeBridgeResponse({
        ok: true,
        data: {
          entries: [{ pubkey: 'a'.repeat(64), relay: 'wss://r.test/' }],
          following_count: 1,
        },
      }),
    ).toEqual({
      ok: true,
      summary: {
        entries: [{ pubkey: 'a'.repeat(64), relayUrl: 'wss://r.test/' }],
        following_count: 1,
      },
    });
  });

  it('reports bridge errors', () => {
    expect(decodeBridgeResponse({ ok: false, message: 'nope' })).toEqual({
      ok: false,
      message: 'nope',
    });
  });
});
