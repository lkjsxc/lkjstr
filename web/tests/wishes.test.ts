import { afterEach, expect, it, vi } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import { setLang } from '../src/shared/i18n.ts';
import { learnPerson } from '../src/shared/people.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountCompose } from '../src/views/compose.ts';
import { mountFeedBar } from '../src/views/feed-bar.ts';
import { avatar } from '../src/views/parts.ts';
import { openTabSearch } from '../src/wm/tab-search.ts';
import { person, setup } from './wishes-support.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  setLang('en');
});

it('keeps period node, half-typed value and selection through account and filter-setting redraws', async () => {
  setLang('en');
  const x = setup();
  const slot = document.createElement('div');
  x.el.append(slot);
  const state = { filter: { open: true } };
  const reopen = vi.fn();
  const off = mountFeedBar({
    kind: 'global',
    el: x.el,
    slot,
    state,
    env: x.env,
    save() {},
    reopen,
  });
  const input = slot.querySelector<HTMLInputElement>('.pdays input')!;
  input.focus();
  for (const char of '2000/01/01') {
    const expected = input.value + char;
    input.setRangeText(char, input.selectionStart!, input.selectionEnd!, 'end');
    input.dispatchEvent(new Event('input'));
    x.engine.accounts.set({ ...x.engine.accounts.get() });
    expect(slot.querySelector('.pdays input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe(expected);
    expect(input.selectionStart).toBe(expected.length);
  }
  expect(reopen).toHaveBeenCalledTimes(1);
  input.setSelectionRange(3, 3);
  x.env.settings.patch({ showFilters: false });
  expect(input.selectionStart).toBe(3);
  expect(input.isConnected).toBe(true);
  input.blur();
  await Promise.resolve();
  expect(slot.querySelector<HTMLInputElement>('.pdays input')?.value).toBe('2000/01/01');
  off();
});

it('takes a mention using Tab, shifts it with text, dissolves an edited name, and respects IME', async () => {
  setLang('en');
  const x = setup();
  const off = mountCompose(x.el, x.env);
  const area = x.el.querySelector('textarea')!;
  const type = (text: string) => {
    area.value = text;
    area.setSelectionRange(text.length, text.length);
    area.dispatchEvent(new Event('input'));
  };
  area.focus();
  type('@ali');
  await Promise.resolve();
  expect(x.el.querySelector('.mention-menu')?.hasAttribute('hidden')).toBe(false);
  area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
  expect(area.value).toBe('@Alice ');
  expect(x.el.querySelector('.mention-preview')?.textContent).toBe('@Alice');
  area.setRangeText('🌿 ', 0, 0, 'end');
  area.dispatchEvent(new Event('input'));
  expect(x.el.querySelector('.mention-preview')?.textContent).toBe('@Alice');
  area.setRangeText('x', 5, 5, 'end');
  area.dispatchEvent(new Event('input'));
  expect(x.el.querySelector('.mention-preview')?.textContent).toBe('');
  area.dispatchEvent(new CompositionEvent('compositionstart'));
  type('@ali');
  expect(x.el.querySelector('.mention-menu')?.hasAttribute('hidden')).toBe(true);
  const enter = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true });
  area.dispatchEvent(enter);
  expect(enter.defaultPrevented).toBe(false);
  expect(area.value).toBe('@ali');
  area.dispatchEvent(new CompositionEvent('compositionend'));
  await Promise.resolve();
  expect(x.el.querySelector('.mention-menu')?.hasAttribute('hidden')).toBe(false);
  area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
  expect(area.value).toBe('@ali');
  type('other');
  type('@ali');
  await Promise.resolve();
  expect(x.el.querySelector('.mention-menu')?.hasAttribute('hidden')).toBe(false);
  off();
  expect(x.requests.every((r) => r.closed)).toBe(true);
});

for (const channel of [undefined, 'room'])
  it(`frees ${channel ? 'channel' : 'reply'} input immediately and restores a failed draft for Edit`, async () => {
    setLang('en');
    const x = setup();
    let finish!: (r: ActResult) => void;
    saveViewState(x.env.instance, {
      text: 'first',
      replyTo: channel ? undefined : 'parent',
      media: [{ url: 'https://example.test/a.png', mime: 'image/png', type: 'image' }],
    });
    x.act.mockImplementation(
      () =>
        new Promise<ActResult>((done) => {
          finish = done;
        }),
    );
    const off = mountCompose(x.el, x.env, channel);
    const area = x.el.querySelector('textarea')!;
    (x.el.querySelector('.primary') as HTMLButtonElement).click();
    expect(area.value).toBe('');
    expect(document.activeElement).toBe(area);
    expect(x.el.querySelector('.thumb')).toBeNull();
    area.value = 'next';
    area.dispatchEvent(new Event('input'));
    expect((x.el.querySelector('.primary') as HTMLButtonElement).disabled).toBe(false);
    finish({ t: 'result', req: 'r', ok: false, error: { code: 'signer-refused' } });
    await Promise.resolve();
    expect(area.value).toBe('next');
    expect(x.el.querySelector('.outbox')?.textContent).toContain('first');
    area.value = '';
    area.dispatchEvent(new Event('input'));
    [...x.el.querySelectorAll('button')].find((b) => b.textContent === 'Edit')!.click();
    expect(area.value).toBe('first');
    expect(x.el.querySelector('.thumb.done')).not.toBeNull();
    off();
  });

it('keeps the draft in its field when durable storage fails', () => {
  setLang('en');
  const x = setup();
  const off = mountCompose(x.el, x.env);
  const area = x.el.querySelector('textarea')!;
  area.value = 'do not lose';
  area.dispatchEvent(new Event('input'));
  vi.stubGlobal(
    'localStorage',
    new Proxy(localStorage, {
      get(target, key) {
        if (key === 'setItem')
          return () => {
            throw new Error('quota');
          };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
  );
  (x.el.querySelector('.primary') as HTMLButtonElement).click();
  expect(area.value).toBe('do not lose');
  expect(x.act).not.toHaveBeenCalled();
  expect(x.el.textContent).toContain('could not be saved');
  off();
});

it('updates a remembered face in place and retries a failed URL when kind 0 changes', () => {
  const a = {
    ...person,
    pubkey: 'b'.repeat(64),
    picture: 'https://example.test/a.png',
    profileId: 'old',
  };
  learnPerson(a);
  const face = avatar(a);
  document.body.append(face);
  const image = face.querySelector('img')!;
  learnPerson({ ...a, name: a.pubkey, picture: undefined, profileId: undefined });
  expect(face.querySelector('img')).toBe(image);
  image.dispatchEvent(new Event('error'));
  expect(face.textContent).toBe('A');
  expect(face.querySelector('img')).toBeNull();
  learnPerson({ ...a, profileId: 'new', name: 'Bea' });
  expect(document.querySelector('[data-face]')).toBe(face);
  expect(face.textContent).toBe('B');
  expect(face.querySelector('img')).not.toBe(image);
  expect(face.querySelector('img')?.src).toBe(a.picture);
});

it('clears an earlier delivery result when a new post starts', async () => {
  setLang('en');
  const x = setup();
  let finish!: (r: ActResult) => void;
  x.act.mockResolvedValueOnce({
    t: 'result',
    req: 'one',
    ok: true,
    delivery: [{ url: 'wss://local.test', state: 'ok' }],
  });
  x.act.mockImplementationOnce(
    () =>
      new Promise<ActResult>((done) => {
        finish = done;
      }),
  );
  const off = mountCompose(x.el, x.env);
  const area = x.el.querySelector('textarea')!;
  const send = (text: string) => {
    area.value = text;
    area.dispatchEvent(new Event('input'));
    (x.el.querySelector('.primary') as HTMLButtonElement).click();
  };
  send('first');
  await Promise.resolve();
  expect(x.el.querySelector('.cresult')?.textContent).toContain('Delivered');
  send('second');
  expect(x.el.querySelector('.cresult')?.textContent).not.toContain('Delivered');
  expect(x.el.querySelector('.outbox')?.textContent).toContain('second');
  finish({ t: 'result', req: 'two', ok: true });
  await Promise.resolve();
  off();
});

it('offers Their Home for a known username even when the display name differs', async () => {
  setLang('en');
  const x = setup();
  const open = vi.fn();
  const anchor = document.createElement('button');
  document.body.append(anchor);
  openTabSearch(x.env.layer, {
    engine: x.engine,
    anchor: () => anchor,
    tabs: () => [],
    show() {},
    open,
    front: () => undefined,
  });
  const field = x.env.layer.querySelector('input')!;
  field.value = 'different-handle';
  field.dispatchEvent(new Event('input'));
  await Promise.resolve();
  const home = [...x.env.layer.querySelectorAll('button')].find((button) =>
    button.textContent?.includes("Alice's Home"),
  );
  expect(home).toBeDefined();
  home!.click();
  expect(open).toHaveBeenCalledWith('their-home', { pubkey: person.pubkey, title: "Alice's Home" });
  expect(x.requests.every((r) => r.closed)).toBe(true);
});
