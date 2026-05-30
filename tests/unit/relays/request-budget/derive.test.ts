import { describe, expect, it } from 'vitest';
import { deriveRequestBudget } from '../../../../src/lib/relays/request-budget/derive';
import type { RequestBudgetInput } from '../../../../src/lib/relays/request-budget/types';

describe('deriveRequestBudget', () => {
  it('uses app caps without false metadata policy claims', () => {
    const budget = deriveRequestBudget(input({ pageSize: 20 }));

    expect(budget.filterLimit).toBe(20);
    expect(budget.maxEvents).toBe(40);
    expect(budget.warnings).toEqual([]);
  });

  it('clamps filter limits with NIP-11 max limit', () => {
    const budget = deriveRequestBudget(
      input({
        pageSize: 50,
        relayInfo: { limitation: { maxLimit: 10 } },
      }),
    );

    expect(budget.filterLimit).toBe(10);
    expect(budget.warnings).toContainEqual(
      expect.objectContaining({ kind: 'relay-limit-clamped', value: 10 }),
    );
  });

  it('records explicit limit warnings above relay default limit', () => {
    const budget = deriveRequestBudget(
      input({
        pageSize: 40,
        relayInfo: { limitation: { defaultLimit: 20 } },
      }),
    );

    expect(budget.filterLimit).toBe(40);
    expect(budget.warnings).toContainEqual(
      expect.objectContaining({ kind: 'relay-default-limit', value: 20 }),
    );
  });

  it('preserves exact event lookup as a small exact read', () => {
    const budget = deriveRequestBudget(
      input({
        purpose: 'event-lookup',
        exactEventLookup: true,
        requestedFilterLimit: 1,
        pageSize: 1,
      }),
    );

    expect(budget.filterLimit).toBe(1);
    expect(budget.maxEvents).toBe(1);
  });

  it('keeps search intent under search caps', () => {
    const budget = deriveRequestBudget(
      input({
        surface: 'search',
        purpose: 'search',
        hasSearchFilter: true,
        requestedFilterLimit: 400,
      }),
    );

    expect(budget.filterLimit).toBe(100);
    expect(budget.warnings).toContainEqual(
      expect.objectContaining({ kind: 'app-limit-clamped', value: 100 }),
    );
  });

  it('does not add page limits to live reads without requested limits', () => {
    const budget = deriveRequestBudget(
      input({ phase: 'live', pageSize: 30, requestedFilterLimit: undefined }),
    );

    expect(budget.filterLimit).toBeUndefined();
  });

  it('records policy warnings without suppressing the relay', () => {
    const budget = deriveRequestBudget(
      input({
        relayInfo: {
          limitation: {
            authRequired: true,
            paymentRequired: true,
            restrictedWrites: true,
            minPowDifficulty: 4,
            createdAtLowerLimit: 1,
          },
        },
      }),
    );

    expect(budget.relayUrl).toBe('wss://relay.example/');
    expect(budget.warnings.map((warning) => warning.kind)).toEqual(
      expect.arrayContaining([
        'auth-required',
        'payment-required',
        'restricted-writes',
        'pow-required',
        'created-at-bound',
      ]),
    );
  });
});

function input(
  overrides: Partial<RequestBudgetInput> = {},
): RequestBudgetInput {
  return {
    surface: 'home',
    phase: 'page',
    purpose: 'feed',
    pageSize: 20,
    relayUrl: 'wss://relay.example/',
    filterCount: 1,
    hasSearchFilter: false,
    exactEventLookup: false,
    ...overrides,
  };
}
