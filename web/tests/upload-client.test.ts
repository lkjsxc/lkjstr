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
