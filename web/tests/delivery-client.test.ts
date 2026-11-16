import { expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';

it('continues delivery after the action resolves until its displayed result is released', async () => {
  let receive!: (m: FromEngine) => void;
  const sent: ToEngine[] = [];
  const engine = createEngine({
    post: (m) => void sent.push(m),
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  });
  const delivery = vi.fn();
  const result = engine.act(
    { a: 'publish', as: 'author', what: { k: 'note', draft: { text: 'note' } } },
    { delivery },
  );
  const req = sent.find((m) => m.t === 'act')!.req;
  receive({
    t: 'result',
    req,
    ok: true,
    delivery: [
      { url: 'a', state: 'ok' },
      { url: 'b', state: 'pending' },
    ],
  });
  expect((await result).ok).toBe(true);
  receive({
    t: 'delivery',
    req,
    relays: [
      { url: 'a', state: 'ok' },
      { url: 'b', state: 'ok' },
    ],
  });
  expect(delivery).toHaveBeenCalledOnce();
  engine.dispose();
});
it('releases the delivery listener and its engine hint when the result leaves the composer', async () => {
  let receive!: (m: FromEngine) => void;
  const sent: ToEngine[] = [];
  const engine = createEngine({
    post: (m) => void sent.push(m),
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  });
  const delivery = vi.fn();
  const controller = new AbortController();
  const result = engine.act(
    { a: 'publish', as: 'a', what: { k: 'note', draft: { text: 'release' } } },
    { delivery, deliverySignal: controller.signal },
  );
  const req = sent.find((m) => m.t === 'act')!.req;
  receive({ t: 'result', req, ok: true, delivery: [{ url: 'a', state: 'ok' }] });
  await result;
  expect(sent.filter((m) => m.t === 'hint').at(-1)).toMatchObject({
    hint: { deliveryWatches: [req] },
  });
  controller.abort();
  await Promise.resolve();
  receive({ t: 'delivery', req, relays: [{ url: 'a', state: 'ok' }] });
  expect(delivery).not.toHaveBeenCalled();
  expect(sent.filter((m) => m.t === 'hint').at(-1)).toMatchObject({
    hint: { deliveryWatches: [] },
  });
  engine.dispose();
});
