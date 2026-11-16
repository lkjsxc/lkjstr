import { afterEach, expect, it, vi } from 'vitest';
import { createEngine, type Transport } from '../src/engine/client.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';

afterEach(() => vi.useRealTimers());
it('settles a lost upload reply and ignores late progress or success', async () => {
  vi.useFakeTimers();
  let receive: (msg: FromEngine) => void = () => {};
  const sent: ToEngine[] = [];
  const transport: Transport = {
    post: (m) => void sent.push(m),
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  };
  const engine = createEngine(transport);
  const progress = vi.fn();
  const result = engine.act(
    {
      a: 'upload',
      as: 'account',
      server: 'https://media.test',
      name: 'file.png',
      mime: 'image/png',
      bytes: new ArrayBuffer(4),
    },
    { progress },
  );
  const action = sent.find((m) => m.t === 'act');
  if (!action || action.t !== 'act') throw new Error('no upload action');
  receive({
    t: 'progress',
    req: action.req,
    sent: 0,
    total: 4,
    server: 'https://media.test',
    phase: 'signing',
  });
  expect(progress.mock.calls[0]?.[2].phase).toBe('signing');
  await vi.advanceTimersByTimeAsync(300_000);
  expect(await result).toMatchObject({
    ok: false,
    error: { code: 'upload-timeout', message: 'https://media.test' },
  });
  receive({ t: 'progress', req: action.req, sent: 4, total: 4 });
  receive({ t: 'result', req: action.req, ok: true });
  expect(progress).toHaveBeenCalledTimes(1);
  engine.dispose();
});
it('settles pending uploads when the client is disposed', async () => {
  const engine = createEngine({ post() {}, listen() {}, close() {} });
  const result = engine.act({
    a: 'upload',
    as: 'account',
    name: 'file.png',
    mime: 'image/png',
    bytes: new ArrayBuffer(4),
  });
  engine.dispose();
  expect(await result).toMatchObject({ ok: false, error: { code: 'offline' } });
});

it('acknowledges upload cancellation once and suppresses queued or late authorization', async () => {
  let receive: (msg: FromEngine) => void = () => {};
  const sent: ToEngine[] = [];
  const engine = createEngine({
    post: (m) => {
      sent.push(m);
    },
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  });
  const abort = new AbortController();
  const progress = vi.fn();
  const signEvent = vi.fn(async () => ({}));
  (window as { nostr?: unknown }).nostr = { signEvent };
  try {
    const result = engine.act(
      {
        a: 'upload',
        as: 'account',
        name: 'file.png',
        mime: 'image/png',
        bytes: new ArrayBuffer(4),
      },
      { uploadSignal: abort.signal, progress },
    );
    const action = sent.find((m) => m.t === 'act');
    if (!action || action.t !== 'act') throw new Error('missing upload');
    abort.abort();
    abort.abort();
    expect(sent.filter((m) => m.t === 'upload.cancel')).toEqual([
      { t: 'upload.cancel', req: action.req },
    ]);
    receive({ t: 'sign', req: 'held-sign', actionReq: action.req, pubkey: 'account', event: '{}' });
    await Promise.resolve();
    expect(signEvent).not.toHaveBeenCalled();
    receive({ t: 'progress', req: action.req, sent: 4, total: 4 });
    expect(progress).not.toHaveBeenCalled();
    receive({ t: 'result', req: action.req, ok: false, cancelled: true });
    expect(await result).toMatchObject({ ok: false, cancelled: true });
    receive({ t: 'result', req: action.req, ok: true });
    receive({ t: 'progress', req: action.req, sent: 4, total: 4 });
    expect(progress).not.toHaveBeenCalled();
  } finally {
    delete (window as { nostr?: unknown }).nostr;
    engine.dispose();
  }
});
it('does not transfer an already cancelled upload', async () => {
  const sent: ToEngine[] = [];
  const engine = createEngine({
    post: (m) => {
      sent.push(m);
    },
    listen() {},
    close() {},
  });
  const abort = new AbortController();
  abort.abort();
  try {
    const bytes = new ArrayBuffer(4);
    const result = await engine.act(
      { a: 'upload', as: 'account', name: 'file.png', mime: 'image/png', bytes },
      { uploadSignal: abort.signal },
    );
    expect(result).toMatchObject({ ok: false, cancelled: true });
    expect(sent.some((m) => m.t === 'act')).toBe(false);
    expect(bytes.byteLength).toBe(4);
  } finally {
    engine.dispose();
  }
});
it('drops an extension answer if its upload was cancelled during the open dialog', async () => {
  let receive: (msg: FromEngine) => void = () => {};
  const sent: ToEngine[] = [];
  let answer: (value: unknown) => void = () => {};
  const signEvent = vi.fn(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  (window as { nostr?: unknown }).nostr = { signEvent };
  const engine = createEngine({
    post: (m) => {
      sent.push(m);
    },
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  });
  const abort = new AbortController();
  try {
    const result = engine.act(
      {
        a: 'upload',
        as: 'account',
        name: 'file.png',
        mime: 'image/png',
        bytes: new ArrayBuffer(4),
      },
      { uploadSignal: abort.signal },
    );
    const action = sent.find((m) => m.t === 'act');
    if (!action || action.t !== 'act') throw new Error('missing upload');
    receive({ t: 'sign', req: 'old-sign', actionReq: action.req, pubkey: 'account', event: '{}' });
    expect(signEvent).toHaveBeenCalledTimes(1);
    abort.abort();
    receive({ t: 'result', req: action.req, ok: false, cancelled: true });
    answer({ old: true });
    await Promise.resolve();
    expect(sent.some((m) => m.t === 'signed' && m.req === 'old-sign')).toBe(false);
    expect((await result).cancelled).toBe(true);
  } finally {
    delete (window as { nostr?: unknown }).nostr;
    engine.dispose();
  }
});
