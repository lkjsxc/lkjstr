import { afterEach, expect, it, vi } from 'vitest';
import type { ActResult, ActWatch } from '../src/engine/client.ts';
import type { Action, Delivery } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { mountCompose } from '../src/views/compose.ts';
import { setup } from './wishes-support.ts';

afterEach(() => {
  setLang('en');
  localStorage.clear();
  document.body.replaceChildren();
});
function start(relays: Delivery[], ok = true) {
  const x = setup();
  let watch!: ActWatch;
  const act = vi.fn<(action: Action, watch?: ActWatch) => Promise<ActResult>>((_, next) => {
    watch = next!;
    return Promise.resolve({
      t: 'result',
      req: 'post',
      ok,
      delivery: relays,
      error: ok ? undefined : { code: 'rejected' },
    });
  });
  x.engine.act = act;
  const off = mountCompose(x.el, x.env);
  const field = x.el.querySelector('textarea')!;
  field.value = 'delivery';
  field.dispatchEvent(new Event('input'));
  (x.el.querySelector('.primary') as HTMLButtonElement).click();
  return {
    ...x,
    off,
    late: (relays: Delivery[]) => watch.delivery?.(relays),
    signal: () => watch.deliverySignal,
  };
}
it('redraws a late result and removes its unanswered row without changing the next draft', async () => {
  setLang('en');
  const x = start([
    { url: 'wss://a.test/', state: 'ok' },
    { url: 'wss://b.test/', state: 'timeout' },
  ]);
  await vi.waitFor(() =>
    expect(x.el.querySelector('[role="status"]')?.textContent).toContain('Delivered to 1 of 2'),
  );
  const status = x.el.querySelector('[role="status"]')!;
  expect(status.textContent).toContain('b.test/: no answer yet');
  expect(status.textContent).not.toContain('timeout');
  expect(status.querySelector('.error')).toBeNull();
  const field = x.el.querySelector('textarea')!;
  field.value = 'next draft';
  x.late([
    { url: 'wss://a.test/', state: 'ok' },
    { url: 'wss://b.test/', state: 'ok' },
  ]);
  expect(status.textContent).toContain('Delivered to 2 of 2');
  expect(status.textContent).not.toContain('b.test');
  expect(field.value).toBe('next draft');
  expect(x.signal()?.aborted).toBe(false);
  x.off();
  expect(x.signal()?.aborted).toBe(true);
});
it.each([false, true])(
  'uses red only when every relay failed (unanswered=%s)',
  async (unanswered) => {
    setLang('ja');
    const x = start(
      [
        { url: 'wss://a.test/', state: 'failed', message: 'blocked: policy' },
        {
          url: 'wss://b.test/',
          state: unanswered ? 'timeout' : 'failed',
          message: unanswered ? undefined : 'blocked: test',
        },
      ],
      false,
    );
    await vi.waitFor(() =>
      expect(x.el.querySelector('[role="status"]')?.textContent).toContain('blocked: policy'),
    );
    const status = x.el.querySelector('[role="status"]')!;
    expect(!!status.querySelector('.error')).toBe(!unanswered);
    if (unanswered) expect(status.textContent).toContain('まだ返事がありません');
    expect(status.textContent).not.toContain('timeout');
    if (unanswered) {
      x.late([
        { url: 'wss://a.test/', state: 'failed', message: 'blocked: policy' },
        { url: 'wss://b.test/', state: 'ok' },
      ]);
      expect(x.el.querySelector('.cdraft')).toBeNull();
    }
    x.off();
  },
);
it('keeps late updates when a pending composer remounts before its first result', async () => {
  setLang('en');
  const x = start([
    { url: 'wss://a.test/', state: 'ok' },
    { url: 'wss://b.test/', state: 'pending' },
  ]);
  x.off();
  expect(x.signal()?.aborted).toBe(false);
  const off = mountCompose(x.el, x.env);
  await vi.waitFor(() =>
    expect(x.el.querySelector('[role="status"]')?.textContent).toContain('Delivered to 1 of 2'),
  );
  x.late([
    { url: 'wss://a.test/', state: 'ok' },
    { url: 'wss://b.test/', state: 'ok' },
  ]);
  expect(x.el.querySelector('[role="status"]')?.textContent).toContain('Delivered to 2 of 2');
  off();
  expect(x.signal()?.aborted).toBe(true);
});
it('updates the sending count and unanswered rows before the first result', async () => {
  setLang('en');
  const relays: Delivery[] = [
    { url: 'wss://a.test/', state: 'ok' },
    { url: 'wss://b.test/', state: 'pending' },
  ];
  const x = start(relays);
  x.late(relays);
  expect(x.el.querySelector('[role="status"]')?.textContent).toContain('Sending… 1 of 2');
  expect(x.el.querySelector('[role="status"]')?.textContent).toContain('no answer yet');
  await Promise.resolve();
  x.off();
});
