import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { FromEngine, ProfileRow, ToEngine } from '../src/engine/protocol.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountFeed } from '../src/views/feed.ts';
import { account, PUBKEY, vaultEnv } from './vault-ui-fixture.ts';

const cleanup: (() => void)[] = [];
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function feed(show = 'all', saved: object = {}) {
  const fixture = vaultEnv();
  let receive!: (message: FromEngine) => void;
  const sent: ToEngine[] = [];
  const engine = createEngine({
    post: (message) => void sent.push(message),
    listen: (handler) => {
      receive = handler;
    },
    close() {},
  });
  receive({ t: 'ready', version: 13, engine: 'fixture' });
  receive({ t: 'accounts', accounts: [account()], active: PUBKEY });
  saveViewState(fixture.env.instance, { pubkey: PUBKEY, show, ...saved });
  const dispose = mountFeed(fixture.el, { ...fixture.env, engine }, 'profile');
  cleanup.push(fixture.dispose, () => engine.dispose(), dispose);
  const opened = sent.find((message) => message.t === 'open');
  if (opened?.t !== 'open') throw new Error('missing profile subscription');
  const profile: ProfileRow = {
    kind: 'profile',
    key: `profile:${PUBKEY}`,
    author: account().author,
    about: [],
    relays: [],
    partial: false,
    followed: false,
    followsYou: false,
    self: true,
    muted: false,
    followers: 1,
  };
  receive({ t: 'rows', sub: opened.sub, rows: [profile], atTop: true, atBottom: true });
  const bar = fixture.el.querySelector<HTMLElement>('.pkinds')!;
  expect(bar).not.toBeNull();
  let horizontal = 0;
  Object.defineProperties(bar, {
    clientWidth: { get: () => (bar.isConnected ? 370 : 0) },
    scrollWidth: { get: () => (bar.isConnected ? 560 : 0) },
    scrollLeft: {
      get: () => horizontal,
      set: (value: number) => {
        horizontal = Math.min(190, Math.max(0, value));
      },
    },
  });
  bar.getBoundingClientRect = () => new DOMRect(10, 0, bar.clientWidth, 30);
  const buttons = (): void => {
    [...bar.querySelectorAll<HTMLElement>('.pkind')].forEach((button, index) => {
      Object.defineProperty(button, 'offsetWidth', { configurable: true, value: 70 });
      button.getBoundingClientRect = () => new DOMRect(10 + index * 70 - bar.scrollLeft, 0, 70, 30);
    });
  };
  buttons();
  const current = (): string => {
    const message = sent.findLast((entry) => entry.t === 'open');
    if (message?.t !== 'open') throw new Error('missing profile subscription');
    return message.sub;
  };
  return {
    bar,
    el: fixture.el,
    queries: () => sent.flatMap((entry) => (entry.t === 'open' ? [entry.query] : [])),
    buttons,
    rows: (followers: number) =>
      receive({
        t: 'rows',
        sub: current(),
        rows: [{ ...profile, followers }],
        atTop: true,
        atBottom: true,
      }),
    patch: (followers: number) =>
      receive({
        t: 'patch',
        sub: current(),
        ops: [{ op: 'update', row: { ...profile, followers } }],
      }),
  };
}

it('preserves a manual profile-tab offset when a count patch arrives before its scroll event', async () => {
  const f = feed();
  const bar = f.bar;
  await vi.advanceTimersByTimeAsync(20);
  expect(bar.querySelector('.on')?.textContent).toBe('All');
  expect(bar.scrollLeft).toBe(190);

  const oldHeader = bar.parentElement!;
  bar.scrollLeft = 0;
  expect(bar.scrollLeft).toBe(0);
  // Do not dispatch scroll or advance a frame before the actual feed update.
  f.patch(2);

  expect(oldHeader.isConnected).toBe(false);
  expect(bar.parentElement).not.toBe(oldHeader);
  expect(f.el.querySelector('.pkinds')).toBe(bar);
  expect(bar.parentElement?.querySelector('.pstats')?.textContent).toContain('2 followers');
  expect(bar.scrollLeft).toBe(0);
  await vi.advanceTimersByTimeAsync(20);
  expect(bar.scrollLeft).toBe(0);
});

it('reveals an explicit All selection when its new header and count patch arrive before a frame', async () => {
  const f = feed('posts');
  await vi.advanceTimersByTimeAsync(20);
  expect(f.bar.scrollLeft).toBe(0);
  const oldHeader = f.bar.parentElement!;
  f.bar.querySelector<HTMLButtonElement>('.pkind:last-child')!.click();
  f.buttons();
  f.rows(2);
  f.patch(3);

  expect(oldHeader.isConnected).toBe(false);
  expect(f.bar.querySelector('.on')?.textContent).toBe('All');
  expect(f.bar.parentElement?.querySelector('.pstats')?.textContent).toContain('3 followers');
  expect(f.bar.scrollLeft).toBe(190);
  await vi.advanceTimersByTimeAsync(20);
  expect(f.bar.scrollLeft).toBe(190);
});

it.each([
  { profileReposts: false },
  { profileReposts: false, show: undefined, filter: { reposts: false } },
])('always opens Profile Posts including reposts with legacy saved state %j', (saved) => {
  const f = feed('posts', saved);
  expect(f.queries()[0]).toMatchObject({ source: 'profile', show: 'posts' });
  expect(f.queries()[0]).not.toHaveProperty('reposts');
  expect(f.bar.querySelector('.on')?.textContent).toBe('Posts');
  expect(f.el.querySelector('[role="group"][aria-label="Reposts"]')).toBeNull();
  f.bar.querySelector<HTMLButtonElement>('.pkind:nth-child(3)')!.click();
  expect(f.queries().at(-1)).toMatchObject({ source: 'profile', show: 'reposts' });
  f.bar.querySelector<HTMLButtonElement>('.pkind:first-child')!.click();
  expect(f.queries().at(-1)).toMatchObject({ source: 'profile', show: 'posts' });
  expect(f.queries().at(-1)).not.toHaveProperty('reposts');
  expect(f.el.querySelector('[role="group"][aria-label="Reposts"]')).toBeNull();
});
