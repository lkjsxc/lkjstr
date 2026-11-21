import { afterEach, expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { Delivery, FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { createChannelOutbox } from '../src/views/compose-outbox.ts';
import { setup } from './wishes-support.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

for (const remount of [false, true])
  for (const ok of [false, true])
    it(`releases the current watch after an older ${ok ? 'successful' : 'failed'} send drains (remount=${remount})`, async () => {
      const x = setup();
      const sent: ToEngine[] = [];
      let receive!: (msg: FromEngine) => void;
      const engine = createEngine({
        post: (msg) => void sent.push(msg),
        listen: (fn) => {
          receive = fn;
        },
        close() {},
      });
      const act = vi.spyOn(engine, 'act');
      const delivery = vi.fn();
      const env = { ...x.env, engine };
      const mount = () => createChannelOutbox(env, [], vi.fn(), delivery, () => false);
      let box = mount();
      try {
        box.publish({ text: 'older pending' });
        box.publish({ text: 'newer settled' });
        const [older, newer] = sent.filter((msg) => msg.t === 'act');
        const signal = act.mock.calls[1]![1]!.deliverySignal!;
        const relays: Delivery[] = [
          { url: 'wss://a.test/', state: 'ok' },
          { url: 'wss://b.test/', state: 'pending' },
        ];
        receive({ t: 'result', req: newer!.req, ok: true, delivery: relays });
        await Promise.resolve();
        box.dispose();
        expect(signal.aborted).toBe(false);
        if (remount) box = mount();
        receive({
          t: 'result',
          req: older!.req,
          ok,
          error: ok ? undefined : { code: 'rejected' },
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(signal.aborted).toBe(!remount);
        expect(sent.filter((msg) => msg.t === 'hint').at(-1)).toMatchObject({
          hint: { deliveryWatches: remount ? [newer!.req] : [] },
        });
        delivery.mockClear();
        const confirmed: Delivery[] = relays.map((relay) => ({ ...relay, state: 'ok' }));
        receive({ t: 'delivery', req: newer!.req, relays: confirmed });
        if (remount)
          expect(delivery).toHaveBeenCalledWith(
            confirmed,
            true,
            undefined,
            undefined,
            expect.any(Number),
          );
        else expect(delivery).not.toHaveBeenCalled();
        box.dispose();
        await Promise.resolve();
        expect(signal.aborted).toBe(true);
        expect(sent.filter((msg) => msg.t === 'hint').at(-1)).toMatchObject({
          hint: { deliveryWatches: [] },
        });
      } finally {
        box.dispose();
        engine.dispose();
      }
    });
