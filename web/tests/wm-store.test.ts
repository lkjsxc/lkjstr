import { afterEach, expect, it, vi } from 'vitest';
import { pane } from '../src/wm/layout.ts';
import { createWmStore } from '../src/wm/store.ts';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

it('applies a competing layout save only within the workspace that wrote it', () => {
  vi.useFakeTimers();
  const store = createWmStore();
  const first = store.space('main', 1);
  const observed = vi.fn();
  first.watch(observed);
  const search = pane(['global', 'search'], 'search');
  const global = pane(['global']);
  const foreignSave = (key: string): void => {
    const newValue = JSON.stringify(global);
    localStorage.setItem(key, newValue);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  };
  try {
    first.save(search);
    foreignSave('lkjstr:layout:main');
    vi.advanceTimersByTime(500);
    expect(observed).toHaveBeenCalledExactlyOnceWith(global);
    expect(store.get('layout:main')).toEqual(global);
    expect(localStorage.getItem('lkjstr:layout:main')).toBe(JSON.stringify(global));

    observed.mockClear();
    first.save(search);
    foreignSave('lkjstr:layout:main:2');
    vi.advanceTimersByTime(500);
    expect(observed).not.toHaveBeenCalled();
    expect(localStorage.getItem('lkjstr:layout:main')).toBe(JSON.stringify(search));
    expect(store.get('layout:main:2')).toEqual(global);
  } finally {
    store.dispose();
  }
});
