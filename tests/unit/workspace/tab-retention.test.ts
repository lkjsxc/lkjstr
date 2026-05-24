import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTabRetention } from '../../../src/lib/workspace/tab-retention';
import { createSessionTabSnapshots } from '../../../src/lib/workspace/session-tab-snapshots';

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

describe('session tab snapshots', () => {
  afterEach(() => vi.useRealTimers());

  it('restores and consumes snapshots inside the retention window', () => {
    vi.useFakeTimers();
    const snapshots = createSessionTabSnapshots<{
      id: string;
      scrollTop: number;
    }>();

    snapshots.retain({ id: 'home', scrollTop: 120 }, 10);

    expect(snapshots.take('home')).toEqual({ id: 'home', scrollTop: 120 });
    expect(snapshots.records()).toEqual([]);
    vi.advanceTimersByTime(10_000);
    expect(snapshots.records()).toEqual([]);
  });

  it('caps retained snapshots and releases missing tab ids', () => {
    const released: string[] = [];
    const snapshots = createSessionTabSnapshots<{ id: string }>({
      maxSnapshots: 2,
      released: (tabId, reason) => released.push(`${tabId}:${reason}`),
    });

    snapshots.retain({ id: 'one' }, 10);
    snapshots.retain({ id: 'two' }, 10);
    snapshots.retain({ id: 'three' }, 10);
    snapshots.releaseMissing(new Set(['three']));

    expect(snapshots.records()).toEqual([{ id: 'three' }]);
    expect(released).toEqual([
      'one:retention-replaced',
      'two:tab-removed',
    ]);
  });
});
