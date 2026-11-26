import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shellWorker } from '../scripts/shell-cache.ts';

const body = 'verified shell bytes';
const digest = createHash('sha256').update(body).digest('hex');
const immutable = `/engine-${digest.slice(0, 16)}.wasm`;
type Verify = (path: string, signal?: AbortSignal) => Promise<Response>;
function fixture(fetcher: (path: string, options: RequestInit) => Promise<Response>): Verify {
  const context = {
    self: { addEventListener() {} },
    crypto: webcrypto,
    Response,
    AbortController,
    Uint8Array,
    TextEncoder,
    setTimeout,
    clearTimeout,
    fetch: fetcher,
  };
  return runInNewContext(
    `${shellWorker([
      [immutable, digest],
      ['/index.html', digest],
    ])}\nverified`,
    context,
  );
}
afterEach(() => vi.useRealTimers());

describe('verified shell downloads', () => {
  it('reuses immutable HTTP assets while fetching mutable paths freshly', async () => {
    const requests: RequestInit[] = [];
    const verified = fixture(async (_path, options) => {
      requests.push(options);
      return new Response(body);
    });
    expect(await (await verified(immutable)).text()).toBe(body);
    expect(await (await verified('/index.html')).text()).toBe(body);
    expect(requests.map((r) => r.cache)).toEqual(['force-cache', 'no-store']);
    expect(requests.every((r) => r.credentials === 'omit' && r.redirect === 'error')).toBe(true);
  });
  it('retries a bad immutable cache body once and checks the fresh body too', async () => {
    const modes: (RequestCache | undefined)[] = [];
    const verified = fixture(async (_path, options) => {
      modes.push(options.cache);
      return new Response(options.cache === 'reload' ? body : 'corrupt cache');
    });
    expect(await (await verified(immutable)).text()).toBe(body);
    expect(modes).toEqual(['force-cache', 'reload']);
    const corrupt = fixture(async () => new Response('corrupt again'));
    await expect(corrupt(immutable)).rejects.toThrow('shell asset changed');
    await expect(corrupt('/index.html')).rejects.toThrow('shell asset changed');
  });
  it('does not retry ordinary network failures', async () => {
    let attempts = 0;
    const verified = fixture(async () => {
      attempts++;
      throw new Error('offline');
    });
    await expect(verified(immutable)).rejects.toThrow('offline');
    expect(attempts).toBe(1);
  });

  it('accepts a progressing response lasting more than sixty seconds', async () => {
    vi.useFakeTimers();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const verified = fixture(
      async (_path, options) =>
        new Response(
          new ReadableStream({
            start(stream) {
              controller = stream;
              options.signal?.addEventListener(
                'abort',
                () => stream.error(options.signal?.reason),
                { once: true },
              );
            },
          }),
        ),
    );
    const pending = verified(immutable);
    const encoder = new TextEncoder();
    await vi.advanceTimersByTimeAsync(0);
    for (const part of [body.slice(0, 7), body.slice(7, 14), body.slice(14)]) {
      await vi.advanceTimersByTimeAsync(59_000);
      controller.enqueue(encoder.encode(part));
      await vi.advanceTimersByTimeAsync(0);
    }
    controller.close();
    expect(await (await pending).text()).toBe(body);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts stalled bodies and releases both deadline timers', async () => {
    vi.useFakeTimers();
    const verified = fixture(
      async (_path, options) =>
        new Response(
          new ReadableStream({
            start(stream) {
              options.signal?.addEventListener(
                'abort',
                () => stream.error(options.signal?.reason),
                { once: true },
              );
            },
          }),
        ),
    );
    const outcome = verified(immutable).then(
      () => 'accepted',
      (error: Error) => error.name,
    );
    await vi.advanceTimersByTimeAsync(60_001);
    expect(await outcome).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('caps even a continually progressing response at fifteen minutes', async () => {
    vi.useFakeTimers();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const verified = fixture(
      async (_path, options) =>
        new Response(
          new ReadableStream({
            start(stream) {
              controller = stream;
              options.signal?.addEventListener(
                'abort',
                () => stream.error(options.signal?.reason),
                { once: true },
              );
            },
          }),
        ),
    );
    const outcome = verified(immutable).then(
      () => 'accepted',
      (error: Error) => error.name,
    );
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 29; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
      controller.enqueue(new Uint8Array([1]));
      await vi.advanceTimersByTimeAsync(0);
    }
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await outcome).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('propagates caller cancellation during a body transfer', async () => {
    const caller = new AbortController();
    const verified = fixture(
      async (_path, options) =>
        new Response(
          new ReadableStream({
            start(stream) {
              options.signal?.addEventListener(
                'abort',
                () => stream.error(options.signal?.reason),
                { once: true },
              );
            },
          }),
        ),
    );
    const outcome = verified(immutable, caller.signal).then(
      () => 'accepted',
      (error: Error) => error.name,
    );
    caller.abort();
    expect(await outcome).toBe('AbortError');
  });

  it('reloads an immutable cached 404 exactly once and verifies the replacement', async () => {
    const modes: (RequestCache | undefined)[] = [];
    const verified = fixture(async (_path, options) => {
      modes.push(options.cache);
      return options.cache === 'force-cache'
        ? new Response('missing cached asset', { status: 404 })
        : new Response(body);
    });
    expect(await (await verified(immutable)).text()).toBe(body);
    expect(modes).toEqual(['force-cache', 'reload']);
  });
  it('rejects a failed, corrupt or unavailable reload after a cached 404', async () => {
    for (const kind of ['http', 'corrupt', 'network']) {
      const modes: (RequestCache | undefined)[] = [];
      const verified = fixture(async (_path, options) => {
        modes.push(options.cache);
        if (options.cache === 'force-cache') return new Response('cached missing', { status: 404 });
        if (kind === 'network') throw new Error('offline');
        return new Response('bad replacement', { status: kind === 'http' ? 404 : 200 });
      });
      await expect(verified(immutable)).rejects.toThrow(
        kind === 'http'
          ? 'shell asset unavailable'
          : kind === 'corrupt'
            ? 'shell asset changed'
            : 'offline',
      );
      expect(modes).toEqual(['force-cache', 'reload']);
    }
  });
});
