import { afterEach, expect, it, vi } from 'vitest';
import type { ActResult, ActWatch } from '../src/engine/client.ts';
import type { Action } from '../src/engine/protocol.ts';
import { mountAdd } from '../src/views/account-add.ts';
import { setup } from './wishes-support.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});
it('extension sign-in keeps other methods enabled; starting another method cancels before dispatch', async () => {
  const x = setup();
  const attempts: { action: Action; watch?: ActWatch; done(result: ActResult): void }[] = [];
  x.engine.act = vi.fn(
    (action: Action, watch?: ActWatch) =>
      new Promise<ActResult>((done) => attempts.push({ action, watch, done })),
  );
  const mounted = mountAdd(x.env);
  x.el.append(mounted.el);
  const find = (key: string) => mounted.el.querySelector<HTMLButtonElement>(`[data-f="${key}"]`)!;
  find('extension').click();
  expect(attempts).toHaveLength(1);
  const first = attempts[0]!;
  expect(mounted.el.textContent).not.toContain('Waiting for your extension');
  first.watch?.signerWait?.('finding');
  expect(mounted.el.textContent).toContain('Looking for your signer extension');
  first.watch?.signerWait?.('approval');
  expect(find('create').disabled).toBe(false);
  find('other').click();
  const input = mounted.el.querySelector<HTMLInputElement>('input')!;
  expect(input.disabled).toBe(false);
  input.value = 'fixture';
  input.dispatchEvent(new Event('input'));
  find('key').click();
  expect(first.watch?.signerSignal?.aborted).toBe(true);
  expect(attempts[1]?.action).toMatchObject({ a: 'account.add', how: 'key' });
  first.done({ t: 'result', req: 'old', ok: false, error: { code: 'cancelled' } });
  attempts[1]?.done({ t: 'result', req: 'new', ok: true });
  await Promise.resolve();
  expect(find('extension').disabled).toBe(false);
  expect(mounted.el.textContent).not.toContain('Sign-in stopped');
  mounted.dispose();
});
it('Cancel immediately re-enables extension sign-in and keeps its own message', async () => {
  const x = setup();
  let watch: ActWatch | undefined;
  x.engine.act = vi.fn((_action: Action, w?: ActWatch) => {
    watch = w;
    return new Promise<ActResult>(() => {});
  });
  const mounted = mountAdd(x.env);
  x.el.append(mounted.el);
  const extension = mounted.el.querySelector<HTMLButtonElement>('[data-f="extension"]')!;
  extension.click();
  watch?.signerWait?.('approval');
  mounted.el.querySelector<HTMLButtonElement>('.signer-cancel')?.click();
  expect(watch?.signerSignal?.aborted).toBe(true);
  expect(extension.disabled).toBe(false);
  expect(mounted.el.textContent).toContain('Sign-in stopped.');
  mounted.dispose();
});
