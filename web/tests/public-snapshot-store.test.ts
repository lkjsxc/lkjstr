import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  readPublicSnapshot,
  snapshotIdentity,
  writePublicSnapshot,
} from '../src/engine/public-snapshot-store.ts';
import { note, query } from './public-snapshots-support.ts';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});
const identity = (value: number) => snapshotIdentity({ ...query, text: String(value) }, 'en', true);
const snapshot = () => ({ rows: [note()], anchor: note().key, atTop: true, atBottom: false });

it('refreshes last-read recency and evicts only an older public window', () => {
  localStorage.setItem('lkjstr:settings', 'kept');
  for (let i = 0; i < 32; i++) {
    writePublicSnapshot(identity(i), true, snapshot());
    vi.setSystemTime(Date.now() + 1);
  }
  expect(readPublicSnapshot(identity(0), 'top')).toBeDefined();
  writePublicSnapshot(identity(32), true, snapshot());
  expect(readPublicSnapshot(identity(0), 'top')).toBeDefined();
  expect(readPublicSnapshot(identity(1), 'top')).toBeUndefined();
  expect(localStorage.getItem('lkjstr:settings')).toBe('kept');
  expect(localStorage.length).toBe(33);
});

it('honors the total encoded byte budget and rejects an oversized window before eviction', () => {
  const large = {
    ...snapshot(),
    rows: [{ ...note(), segments: [{ k: 'text' as const, text: 'x'.repeat(55_000) }] }],
  };
  for (let i = 0; i < 32; i++) writePublicSnapshot(identity(i), true, large);
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '');
  const bytes = keys.reduce(
    (sum, key) => sum + (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2,
    0,
  );
  expect(bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(keys.length).toBeLessThan(32);
  const before = keys.map((key) => [key, localStorage.getItem(key)]);
  writePublicSnapshot(identity(33), true, {
    ...large,
    rows: [{ ...note(), segments: [{ k: 'text', text: 'x'.repeat(100_000) }] }],
  });
  expect(keys.map((key) => [key, localStorage.getItem(key)])).toEqual(before);
  expect(readPublicSnapshot(identity(33), 'top')).toBeUndefined();
});
