import { describe, expect, it } from 'vitest';
import {
  estimateReqMessageBytes,
  requestMessageSizeWarning,
} from '../../../../src/lib/relays/request-budget/message-size';
import type { RequestBudget } from '../../../../src/lib/relays/request-budget/types';

describe('request message sizing', () => {
  it('estimates serialized REQ bytes', () => {
    expect(estimateReqMessageBytes('sub', [{ kinds: [1] }])).toBe(
      new TextEncoder().encode('["REQ","sub",{"kinds":[1]}]').byteLength,
    );
  });

  it('diagnoses oversized REQ messages', () => {
    const warning = requestMessageSizeWarning(
      'sub',
      [{ search: 'x'.repeat(80) }],
      requestBudget({ maxMessageLength: 30 }),
    );

    expect(warning).toMatchObject({ kind: 'request-too-large' });
  });

  it('accepts requests under the active cap', () => {
    expect(
      requestMessageSizeWarning(
        'sub',
        [{ kinds: [1] }],
        requestBudget({ maxMessageLength: 1000 }),
      ),
    ).toBeUndefined();
  });
});

function requestBudget(overrides: Partial<RequestBudget> = {}): RequestBudget {
  return {
    relayUrl: 'wss://relay.example/',
    maxEvents: 100,
    timeoutMs: 5000,
    maxSubscriptions: Infinity,
    maxSubscriptionIdLength: 48,
    warnings: [],
    ...overrides,
  };
}
