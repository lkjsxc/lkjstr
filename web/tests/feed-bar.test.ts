import { afterEach, expect, it, vi } from 'vitest';
import { h } from '../src/shared/h.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { type BarState, mountFeedBar } from '../src/views/feed-bar.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});

it('keeps Clear clickable when an account redraw was deferred during typing', async () => {
  const accounts = createSignal({ accounts: [] });
  const env = {
    settings: createSettings(),
    engine: { accounts, info: createSignal({ version: 5 }), me: () => '' },
  } as unknown as ViewEnv;
  const slot = h('div');
  const el = h('div', {}, slot);
  document.body.append(el);
  const state: BarState = { filter: { text: 'fixture', open: true } };
  const reopen = vi.fn();
  const off = mountFeedBar({ kind: 'global', el, slot, state, env, save: vi.fn(), reopen });
  try {
    slot.querySelector<HTMLInputElement>('.rbar input')!.focus();
    accounts.set({ accounts: [] });
    const clear = slot.querySelector<HTMLButtonElement>('.rclear')!;
    // A browser focuses the button between pointerdown and click. Pending
    // redraws must not detach that target before pointerup can activate it.
    clear.focus();
    await Promise.resolve();
    expect(clear.isConnected).toBe(true);
    clear.click();
    expect(state.filter).toEqual({});
    expect(reopen).toHaveBeenCalledOnce();
    const fresh = slot.querySelector<HTMLInputElement>('.rbar input')!;
    expect(fresh.value).toBe('');
    fresh.value = 'fixture';
    fresh.dispatchEvent(new Event('input'));
    fresh.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(reopen).toHaveBeenCalledTimes(2);
    expect(slot.querySelector<HTMLButtonElement>('.rtoggle')!.getAttribute('aria-expanded')).toBe(
      'false',
    );
  } finally {
    off();
  }
});
