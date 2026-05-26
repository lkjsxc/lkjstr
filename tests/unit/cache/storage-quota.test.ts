import { describe, expect, it } from 'vitest';
import {
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
});
