import { describe, expect, it } from 'vitest';
import { pressureState } from '../../../src/lib/cache/cache-budget-decision';
import { deriveSiteStorageBudget } from '../../../src/lib/cache/site-storage-budget';

describe('cache budget decision', () => {
  it('reports below-budget before compaction', () => {
    expect(state({ usage: 64, prunedResources: 0 })).toBe('below-budget');
  });

  it('reports compacted-under-budget after successful pruning', () => {
    expect(state({ usage: 64, prunedResources: 2 })).toBe(
      'compacted-under-budget',
    );
  });

  it('keeps over-target eligible rows candidate-limited', () => {
    expect(state({ eligibleRows: 1 })).toBe('candidate-limited');
  });

  it('distinguishes protected, unknown, and incomplete pressure', () => {
    expect(state({ protectedRows: 4 })).toBe('protected-only');
    expect(state({ unknownOrOverheadBytes: 512 })).toBe('unknown-only');
    expect(state({ inventoryStatus: 'timeout' })).toBe('inventory-incomplete');
  });
});

function state(
  input: Partial<Parameters<typeof pressureState>[0]> & { usage?: number },
) {
  const usage = input.usage ?? 200;
  return pressureState({
    budget: deriveSiteStorageBudget(100, {
      usage,
      quota: 1000,
      ratio: usage / 1000,
    }),
    prunableCacheBytes: 0,
    eligibleRows: 0,
    protectedRows: 0,
    unknownOrOverheadBytes: 0,
    inventoryStatus: 'exact',
    prunedResources: 0,
    storageApiAvailable: true,
    ...input,
  });
}
