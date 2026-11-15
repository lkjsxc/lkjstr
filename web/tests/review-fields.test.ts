import { afterEach, expect, it, vi } from 'vitest';
import { mountCompose } from '../src/views/compose.ts';
import { mountFeedBar } from '../src/views/feed-bar.ts';
import { setup } from './wishes-support.ts';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.body.replaceChildren();
});

it('only reopens search for changed text, flushing pending edits once on blur or Enter', () => {
  vi.useFakeTimers();
  const x = setup();
  const slot = document.createElement('div');
  x.el.append(slot);
  const reopen = vi.fn();
  const state = { text: 'arrived results' };
  const off = mountFeedBar({
    kind: 'search',
    el: x.el,
    slot,
    state,
    env: x.env,
    save() {},
    reopen,
  });
  const input = slot.querySelector<HTMLInputElement>('input[type=search]')!;
  const blur = () => input.dispatchEvent(new Event('blur'));
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };
  blur();
  expect(reopen).not.toHaveBeenCalled();
  type('settled edit');
  vi.advanceTimersByTime(250);
  expect(reopen).toHaveBeenCalledTimes(1);
  blur();
  expect(reopen).toHaveBeenCalledTimes(1);
  type('pending edit');
  blur();
  expect(state.text).toBe('pending edit');
  expect(reopen).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(250);
  expect(reopen).toHaveBeenCalledTimes(2);
  type('temporary');
  type('pending edit');
  blur();
  expect(reopen).toHaveBeenCalledTimes(2);
  type('enter edit');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  blur();
  vi.advanceTimersByTime(250);
  expect(reopen).toHaveBeenCalledTimes(3);
  off();
});

it('closes all mention and pasted-address requests on hide and restores them on show', async () => {
  const x = setup();
  const off = mountCompose(x.el, x.env);
  const area = x.el.querySelector('textarea')!;
  const type = (text: string) => {
    area.value = text;
    area.setSelectionRange(text.length, text.length);
    area.dispatchEvent(new Event('input'));
  };
  const addresses = Array.from({ length: 35 }, (_, i) => `npub1test${i}`).join(' ');
  type(`${addresses} @ali`);
  await Promise.resolve();
  expect(x.requests.filter((r) => !r.closed)).toHaveLength(33);
  expect(x.el.querySelector<HTMLElement>('.mention-menu')?.hidden).toBe(false);
  x.visible.set(false);
  expect(x.requests.every((r) => r.closed)).toBe(true);
  expect(x.el.querySelector<HTMLElement>('.mention-menu')?.hidden).toBe(true);
  type('npub1new @alice');
  expect(x.requests.every((r) => r.closed)).toBe(true);
  x.visible.set(true);
  await Promise.resolve();
  expect(x.requests.filter((r) => !r.closed).map((r) => r.query)).toEqual([
    { source: 'people', ref: 'npub1new' },
    { source: 'people', text: 'alice', account: x.engine.me(), id: undefined },
  ]);
  expect(x.el.querySelector<HTMLElement>('.mention-menu')?.hidden).toBe(false);
  off();
  x.visible.set(false);
  const count = x.requests.length;
  x.visible.set(true);
  expect(x.requests).toHaveLength(count);
  expect(x.requests.every((r) => r.closed)).toBe(true);
});

it('does not open pasted-address or mention requests for an initially hidden composer', () => {
  const x = setup();
  x.visible.set(false);
  const off = mountCompose(x.el, x.env);
  const area = x.el.querySelector('textarea')!;
  area.value = 'npub1test @ali';
  area.setSelectionRange(area.value.length, area.value.length);
  area.dispatchEvent(new Event('input'));
  expect(x.requests).toHaveLength(0);
  x.visible.set(true);
  expect(x.requests).toHaveLength(2);
  x.visible.set(false);
  expect(x.requests.every((r) => r.closed)).toBe(true);
  off();
});
