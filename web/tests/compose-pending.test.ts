// A post is pending at once and stays one steady state, however long signing takes; a second post while the first
// is unsettled leaves the first's counts current; a failure keeps the draft with Retry and leaves the field alone.
import { afterEach, expect, it, vi } from 'vitest';
import type { ActResult, ActWatch } from '../src/engine/client.ts';
import type { Action, Delivery } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { mountCompose } from '../src/views/compose.ts';
import { mountHomeDrafts } from '../src/views/home-drafts.ts';
import { setup } from './wishes-support.ts';

afterEach(() => {
  setLang('en');
  localStorage.clear();
  document.body.replaceChildren();
});

/** A composer whose sends wait until the test answers them, one by one. */
function composer() {
  const x = setup();
  const sends: { action: Action; watch: ActWatch; done(r: Partial<ActResult>): void }[] = [];
  x.engine.act = vi.fn<(action: Action, watch?: ActWatch) => Promise<ActResult>>(
    (action, watch) =>
      new Promise((resolve) =>
        sends.push({
          action,
          watch: watch ?? {},
          done: (r) => resolve({ t: 'result', req: 'r', ok: true, ...r }),
        }),
      ),
  );
  const off = mountCompose(x.el, x.env);
  const field = x.el.querySelector('textarea') as HTMLTextAreaElement;
  const post = (text: string): void => {
    field.value = text;
    field.dispatchEvent(new Event('input'));
    (x.el.querySelector('.primary') as HTMLButtonElement).click();
  };
  const rows = (): string[] =>
    [...x.el.querySelectorAll<HTMLElement>('.outbox .cdraft')].map((r) => r.textContent ?? '');
  return { ...x, off, field, post, sends, rows };
}
const relays = (...states: Delivery['state'][]): Delivery[] =>
  states.map((state, i) => ({ url: `wss://r${i}.test/`, state }));

it('frees the field at once and takes a second post while the first is still signing', async () => {
  const c = composer();
  c.post('first, slow to sign');
  expect(c.field.value).toBe('');
  c.post('second');
  await vi.waitFor(() => expect(c.sends).toHaveLength(2));
  expect(c.rows()).toHaveLength(2);
  const text = c.el.querySelector('.outbox')?.textContent ?? '';
  expect(text).toContain('first, slow to sign');
  expect(text).toContain('second');
  expect(text.toLowerCase()).not.toContain('signing');
});

it('keeps the first post counted while a later one is sent', async () => {
  const c = composer();
  c.post('first');
  c.post('second');
  await vi.waitFor(() => expect(c.sends).toHaveLength(2));
  const [first, second] = c.sends;
  second?.watch.delivery?.(relays('pending', 'pending'));
  first?.watch.delivery?.(relays('ok', 'pending'));
  const outbox = c.el.querySelector('.outbox')?.textContent ?? '';
  expect(outbox).toContain('Sending… 1 of 2 relays have it');
  // The composer's own result line follows the latest post only.
  expect(c.el.querySelector('[role="status"]')?.textContent).toContain('0 of 2');
  first?.done({ ok: true, delivery: relays('ok', 'pending') });
  await vi.waitFor(() => expect(c.el.querySelector('.outbox')?.textContent).not.toContain('first'));
  expect(c.el.querySelector('.outbox')?.textContent).toContain('second');
});

it('a refused post keeps its text with Retry, and Retry does not touch what is being typed', async () => {
  const c = composer();
  c.post('refused one');
  await vi.waitFor(() => expect(c.sends).toHaveLength(1));
  c.field.value = 'typing the next one';
  c.field.dispatchEvent(new Event('input'));
  c.sends[0]?.done({ ok: false, error: { code: 'rejected', message: 'spam filter' } });
  await vi.waitFor(() => expect(c.el.querySelector('.outbox')?.textContent).toContain('Refused'));
  const retry = [...c.el.querySelectorAll<HTMLButtonElement>('.outbox button')].find(
    (b) => b.textContent === 'Retry',
  );
  expect(retry?.disabled).toBe(false);
  retry?.click();
  await vi.waitFor(() => expect(c.sends).toHaveLength(2));
  expect(c.sends[1]?.action).toMatchObject({ what: { draft: { text: 'refused one' } } });
  expect(c.field.value).toBe('typing the next one');
});

it('Home shows the draft as posting until it is signed, then sending, never a word about signing', async () => {
  const c = composer();
  const home = mountHomeDrafts(c.env);
  const off = home.watch(() => home.draw([]));
  c.post('slow to sign');
  await vi.waitFor(() => expect(home.el.querySelector('.home-draft')).not.toBeNull());
  home.draw([]);
  const row = home.el.querySelector<HTMLElement>('.home-draft');
  expect(row?.querySelector('time')?.textContent).toBe('posting…');
  expect(row?.getAttribute('aria-label')).toBeNull();
  expect(row?.querySelector('.acts')).not.toBeNull(); // the room of the signed note's action row
  c.sends[0]?.watch.signed?.('abc');
  home.draw([]);
  expect(home.el.querySelector('.home-draft time')?.textContent).toBe('sending…');
  off();
});

it('extension approval appears in both draft surfaces and Home Cancel preserves the draft', async () => {
  const c = composer();
  const state = c.engine.accounts.get();
  c.engine.accounts.set({
    ...state,
    accounts: state.accounts.map((a) => ({ ...a, signer: 'extension' })),
  });
  const home = mountHomeDrafts(c.env);
  const off = home.watch(() => home.draw([]));
  c.post('extension draft');
  await vi.waitFor(() => expect(c.sends).toHaveLength(1));
  const watch = c.sends[0]!.watch;
  expect(c.rows().join()).toContain('Sending…');
  home.draw([]);
  // P2 explicitly uses compose.pending on both surfaces before a named stage.
  expect(home.el.querySelector('.home-draft time')?.textContent).toBe('Sending…');
  watch.signerWait?.('finding');
  expect(c.rows().join()).toContain('Looking for your signer extension');
  expect(c.el.querySelector('.signer-cancel')).toBeNull();
  watch.signerWait?.('approval');
  home.draw([]);
  expect(c.rows().join()).toContain('Approve there to send.');
  const cancel = home.el.querySelector<HTMLButtonElement>('.signer-cancel');
  expect(cancel?.textContent).toBe('Cancel');
  cancel?.click();
  expect(watch.signerSignal?.aborted).toBe(true);
  c.sends[0]?.done({ ok: false, error: { code: 'cancelled' } });
  await vi.waitFor(() => expect(c.rows().join()).toContain('Not sent.'));
  expect(c.rows().join()).toContain('extension draft');
  expect([...c.el.querySelectorAll('.cdraft button')].map((b) => b.textContent)).toEqual([
    'Retry',
    'Edit',
    'Remove',
  ]);
  off();
  c.off();
});
