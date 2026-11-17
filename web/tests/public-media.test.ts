import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { note } from './public-snapshots-support.ts';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.resetModules();
});
afterEach(async () => {
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
  localStorage.clear();
});
const row = (url: string) => ({ ...note(), media: [{ type: 'image' as const, url }] });

it('restores learned public dimensions after a fresh module load', async () => {
  const url = 'https://images.test/verified-public.png';
  const first = await import('../src/shared/public-media.ts');
  first.rememberPublicMedia([row(url)]);
  first.learnMediaSize(url, 720, 1280);
  await vi.advanceTimersByTimeAsync(201);
  vi.resetModules();
  const reopened = await import('../src/shared/public-media.ts');
  expect(reopened.mediaSize(url)).toMatchObject({ w: 720, h: 1280 });
});

it('keeps private-only and malformed image sizes out of durable storage', async () => {
  const cache = await import('../src/shared/public-media.ts');
  cache.learnMediaSize('https://images.test/private-only.png', 500, 900);
  cache.rememberPublicMedia([row('https://images.test/bad.png')]);
  cache.learnMediaSize('https://images.test/bad.png', Number.POSITIVE_INFINITY, 90);
  await vi.advanceTimersByTimeAsync(201);
  expect(localStorage.length).toBe(0);
});

it('evicts least recently used dimensions within both count and encoded-byte bounds', async () => {
  const cache = await import('../src/shared/public-media.ts');
  for (let i = 0; i < 600; i++) {
    const url = `https://images.test/${i}.png`;
    cache.rememberPublicMedia([row(url)]);
    cache.learnMediaSize(url, 600, 400);
    vi.setSystemTime(Date.now() + 1);
  }
  cache.mediaSize('https://images.test/0.png');
  const next = 'https://images.test/new.png';
  cache.rememberPublicMedia([row(next)]);
  cache.learnMediaSize(next, 600, 400);
  await vi.advanceTimersByTimeAsync(201);
  const key = 'lkjstr:public-media:1';
  const raw = localStorage.getItem(key) ?? '';
  const saved = JSON.parse(raw) as { items: [string, unknown][] };
  expect(saved.items).toHaveLength(600);
  expect(saved.items.some(([url]) => url === 'https://images.test/0.png')).toBe(true);
  expect(saved.items.some(([url]) => url === 'https://images.test/1.png')).toBe(false);
  expect((key.length + raw.length) * 2).toBeLessThanOrEqual(256 * 1024);
});
