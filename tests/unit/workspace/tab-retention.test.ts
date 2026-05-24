import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTabRetention } from '../../../src/lib/workspace/tab-retention';

describe('tab retention', () => {
  afterEach(() => vi.useRealTimers());

  it('expires retained tabs after the configured grace period', () => {
    vi.useFakeTimers();
    const retention = createTabRetention<{ id: string }>();
    retention.retain({ id: 'home' }, 2);
    expect(retention.records().map((tab) => tab.id)).toEqual(['home']);
    vi.advanceTimersByTime(1999);
    expect(retention.records()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(retention.records()).toHaveLength(0);
  });

  it('releases retained tabs when settings or tab membership changes', () => {
    vi.useFakeTimers();
    const retention = createTabRetention<{ id: string }>();
    retention.retain({ id: 'home' }, 300);
    retention.releaseMissing(new Set(['settings']));
    expect(retention.records()).toEqual([]);
    retention.retain({ id: 'settings' }, 300);
    retention.releaseAll();
    vi.advanceTimersByTime(300_000);
    expect(retention.records()).toEqual([]);
  });
});
