import { describe, expect, it } from 'vitest';
import {
  deriveSiteStorageBudget,
  shouldCompactForSiteBudget,
} from '../../../src/lib/cache/site-storage-budget';

describe('site storage budget', () => {
  it('uses the configured target when browser estimates are unavailable', () => {
    const budget = deriveSiteStorageBudget(60, 64, null);
    expect(budget).toMatchObject({
      siteBudgetBytes: 64,
      eventCacheTargetBytes: 64,
      protectedOrNonEventBytes: 0,
      browserUsageBytes: null,
      overSiteBudget: false,
    });
    expect(shouldCompactForSiteBudget(60, budget)).toBe(false);
  });

  it('shrinks event allowance by estimated non-event usage', () => {
    const budget = deriveSiteStorageBudget(50, 64, {
      usage: 80,
      quota: 1000,
      ratio: 0.08,
    });
    expect(budget).toMatchObject({
      siteBudgetBytes: 64,
      protectedOrNonEventBytes: 30,
      eventCacheTargetBytes: 34,
      overSiteBudget: true,
    });
    expect(shouldCompactForSiteBudget(50, budget)).toBe(true);
  });

  it('reports zero event allowance when protected usage fills the target', () => {
    const budget = deriveSiteStorageBudget(5, 64, {
      usage: 70,
      quota: 1000,
      ratio: 0.07,
    });
    expect(budget.eventCacheTargetBytes).toBe(0);
    expect(budget.protectedOrNonEventBytes).toBe(65);
  });

  it('clamps site target to the quota pressure threshold', () => {
    const budget = deriveSiteStorageBudget(50, 200, {
      usage: 80,
      quota: 100,
      ratio: 0.8,
    });
    expect(budget.siteBudgetBytes).toBe(90);
    expect(budget.eventCacheTargetBytes).toBe(60);
    expect(shouldCompactForSiteBudget(50, budget)).toBe(false);
  });
});
