import { describe, expect, it } from 'vitest';
import {
  deriveSiteStorageBudget,
  shouldCompactForSiteBudget,
} from '../../../src/lib/cache/site-storage-budget';

describe('site storage budget', () => {
  it('uses the configured target when browser estimates are unavailable', () => {
    const budget = deriveSiteStorageBudget(64, null);
    expect(budget).toMatchObject({
      siteBudgetBytes: 64,
      browserUsageBytes: null,
      overSiteBudget: false,
    });
    expect(shouldCompactForSiteBudget(60, budget)).toBe(false);
  });

  it('reports browser usage without pruning small real caches', () => {
    const budget = deriveSiteStorageBudget(64, {
      usage: 80,
      quota: 1000,
      ratio: 0.08,
    });
    expect(budget).toMatchObject({
      siteBudgetBytes: 64,
      overSiteBudget: true,
    });
    expect(shouldCompactForSiteBudget(50, budget)).toBe(false);
    expect(shouldCompactForSiteBudget(65, budget)).toBe(true);
  });

  it('does not infer protected bytes in the budget helper', () => {
    const budget = deriveSiteStorageBudget(64, {
      usage: 70,
      quota: 1000,
      ratio: 0.07,
    });
    expect(budget.browserUsageBytes).toBe(70);
    expect(budget.overSiteBudget).toBe(true);
  });

  it('clamps site target to the quota pressure threshold', () => {
    const budget = deriveSiteStorageBudget(200, {
      usage: 80,
      quota: 100,
      ratio: 0.8,
    });
    expect(budget.siteBudgetBytes).toBe(90);
    expect(shouldCompactForSiteBudget(50, budget)).toBe(false);
  });

  it('compacts any prunable cache during quota pressure', () => {
    const budget = deriveSiteStorageBudget(200, {
      usage: 96,
      quota: 100,
      ratio: 0.96,
    });
    expect(budget.quotaPressure).toBe(true);
    expect(shouldCompactForSiteBudget(1, budget)).toBe(true);
  });
});
