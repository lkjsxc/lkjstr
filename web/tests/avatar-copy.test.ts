import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import { avatarWorker } from '../scripts/avatar-cache.ts';

function fixture() {
  let message: (event: unknown) => void = () => {};
  const entries = new Map<string, Response>();
  const cache = {
    delete: async (url: string) => entries.delete(url),
    keys: async () => [...entries.keys()].map((url) => ({ url })),
    put: async (url: string, response: Response) => entries.set(url, response),
  };
  const fetch = vi.fn(async (_url: string, _options?: RequestInit) => ({
    type: 'cors',
    ok: true,
    headers: new Headers({ 'content-type': 'image/png', 'cache-control': 'max-age=120' }),
    body: new Blob(['pixels']).stream(),
  }));
  const decode = vi.fn<() => Promise<{ close: () => void }>>(async () => ({ close() {} }));
  runInNewContext(avatarWorker, {
    self: {
      location: new URL('https://reader.test'),
      navigator: {
        locks: { request: async (...args: unknown[]) => (args.at(-1) as () => unknown)() },
      },
      addEventListener: (name: string, listener: typeof message) => {
        if (name === 'message') message = listener;
      },
    },
    caches: { match: async (url: string) => entries.get(url), open: async () => cache },
    fetch,
    createImageBitmap: decode,
    URL,
    Blob,
    Date,
    Response,
    AbortSignal,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  const offer = (url: string, visible = false) =>
    message({
      data: { k: 'lkjstr-avatar-loaded', url, visible },
      source: { type: 'window' },
      waitUntil() {},
    });
  return { offer, fetch, decode, entries };
}

afterEach(() => vi.useRealTimers());

it('frees a stuck copy under load and starts the visible offer ahead of the backlog', async () => {
  vi.useFakeTimers();
  const { offer, fetch, decode, entries } = fixture();
  const stalled = 'https://images.test/stalled.png';
  const later = 'https://next.test/visible.png';
  const close = vi.fn();
  let finishDecode = () => {};
  decode.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishDecode = () => resolve({ close });
      }),
  );
  offer(stalled);
  await vi.advanceTimersByTimeAsync(0);
  expect(decode).toHaveBeenCalledOnce();
  for (let i = 0; i < 24; i++) offer(`https://images.test/overflow-${i}.png`);
  offer(later, true);
  await vi.advanceTimersByTimeAsync(2501);
  expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(fetch.mock.calls[1]?.[0]).toBe(later);
  expect(entries.has(later)).toBe(true);
  finishDecode();
  await vi.advanceTimersByTimeAsync(0);
  expect(close).toHaveBeenCalledOnce();
  expect(entries.has(stalled)).toBe(false);
});

it('skips further offers for a failed copy while another URL on the same host finishes', async () => {
  vi.useFakeTimers();
  const { offer, fetch, entries } = fixture();
  const failed = 'https://images.test/failed.png';
  const healthy = 'https://images.test/healthy.png';
  fetch.mockRejectedValueOnce(new Error('unavailable'));
  offer(failed);
  await vi.advanceTimersByTimeAsync(0);
  offer(healthy);
  await vi.advanceTimersByTimeAsync(0);
  expect(entries.has(healthy)).toBe(true);
  expect(entries.has(failed)).toBe(false);

  await vi.advanceTimersByTimeAsync(33_000);
  offer(failed);
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([failed, healthy]);
});
