import { describe, expect, it } from 'vitest';
import {
  cacheBudgetPressureLimit,
  defaultCacheMaxBytes,
  isCacheBudgetPressure,
  isQuotaPressure,
  quotaPressureRatio,
} from '../../../src/lib/cache/storage-quota';

describe('storage quota', () => {
  it('detects quota pressure at configured ratio', () => {
    expect(isQuotaPressure({ usage: 90, quota: 100, ratio: 0.9 })).toBe(true);
    expect(isQuotaPressure({ usage: 89, quota: 100, ratio: 0.89 })).toBe(false);
    expect(quotaPressureRatio).toBe(0.9);
  });

  it('treats missing snapshot as no pressure', () => {
    expect(isQuotaPressure(null)).toBe(false);
  });

  it('uses the lower of quota pressure and cache byte budget', () => {
    const snapshot = { usage: 260, quota: 1000, ratio: 0.26 };
    expect(cacheBudgetPressureLimit(snapshot, 256)).toBe(256);
    expect(isCacheBudgetPressure(snapshot, 256)).toBe(true);
    expect(isCacheBudgetPressure(snapshot, 300)).toBe(false);
    expect(defaultCacheMaxBytes).toBe(268_435_456);
  });
});
