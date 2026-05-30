import { describe, expect, it } from 'vitest';
import {
  applyBudgetToFilters,
  effectiveReadOptions,
} from '../../../../src/lib/relays/request-budget/apply';
import type { RequestBudget } from '../../../../src/lib/relays/request-budget/types';
import { readDedupeKey } from '../../../../src/lib/relays/subscription-manager-keys';

describe('request budget application', () => {
  it('keeps custom request filters while clamping unsafe limits', () => {
    const budget = requestBudget({ filterLimit: 50 });
    const result = applyBudgetToFilters(
      [{ kinds: [1], limit: 100 }, { authors: ['a'.repeat(64)] }],
      budget,
    );

    expect(result.filters).toEqual([
      { kinds: [1], limit: 50 },
      { authors: ['a'.repeat(64)], limit: 50 },
    ]);
  });

  it('keeps live filters unchanged when no filter limit exists', () => {
    const filters = [{ kinds: [1] }];

    expect(applyBudgetToFilters(filters, requestBudget()).filters).toBe(
      filters,
    );
  });

  it('dedupe keys use effective read options', () => {
    const request = {
      key: 'read',
      relays: ['wss://relay.example/'],
      filters: [{ kinds: [1], limit: 20 }],
    };
    const left = readDedupeKey(
      request,
      effectiveReadOptions([requestBudget({ maxEvents: 40 })], {}),
    );
    const right = readDedupeKey(
      request,
      effectiveReadOptions([requestBudget({ maxEvents: 40 })], {
        maxEvents: 1000,
      }),
    );

    expect(left).toBe(right);
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
