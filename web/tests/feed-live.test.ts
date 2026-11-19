// Arrivals render immediately while the head or the reader's anchor stays put.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { FromEngine, NoteRow, ToEngine } from '../src/engine/protocol.ts';
import { publicSnapshots } from '../src/engine/public-snapshots.ts';
import { mountFeed } from '../src/views/feed.ts';
import { note } from './public-snapshots-support.ts';
import { account, PUBKEY, vaultEnv } from './vault-ui-fixture.ts';

type Window = Extract<ToEngine, { t: 'window' }>;
const key = (n: number): string => n.toString(16).padStart(64, '0');
const row = (n: number): NoteRow => ({ ...note(key(n)), at: n * 1000 });
const cleanup: (() => void)[] = [];
const close = (): void => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.body.replaceChildren();
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

/** A feed over the real client and the real replay cache; `sent` is what reaches the engine. */
function feed(kind = 'global') {
  const fixture = vaultEnv();
  let receive!: (message: FromEngine) => void;
  const sent: ToEngine[] = [];
  const engine = createEngine(
    publicSnapshots({
      post: (message) => void sent.push(message),
      listen: (handler) => {
        receive = handler;
      },
      close() {},
    }),
  );
  receive({ t: 'ready', version: 13, engine: 'fixture' });
  receive({ t: 'accounts', accounts: [account()], active: PUBKEY });
  const dispose = mountFeed(fixture.el, { ...fixture.env, engine }, kind);
  cleanup.push(fixture.dispose, () => engine.dispose(), dispose);
  const opened = sent.find((message) => message.t === 'open');
  if (opened?.t !== 'open') throw new Error('missing fixture subscription');
  const sub = opened.sub;
  const el = fixture.el;
  return {
    el,
    visible: fixture.visible,
    windows: (): Window[] => sent.filter((message): message is Window => message.t === 'window'),
    last: (): Window | undefined => sent.findLast((message) => message.t === 'window') as Window,
    allow: () => receive({ t: 'cache.policy', sub, allow: true }),
    rows: (values: NoteRow[], atTop = true, atBottom = true) =>
      receive({ t: 'rows', sub, rows: values, atTop, atBottom }),
    arrive: (value: NoteRow, before: string) =>
      receive({ t: 'patch', sub, ops: [{ op: 'insert', before, rows: [value] }] }),
    count: (n: number) => receive({ t: 'fresh', sub, count: n }),
    async scroll(top: number) {
      el.scrollTop = top;
      el.dispatchEvent(new Event('scroll'));
      await vi.advanceTimersByTimeAsync(20);
    },
    drawn: () =>
      [...el.querySelectorAll<HTMLElement>('.list > [data-key]')]
        .map((node) => node.dataset.key ?? '')
        .filter((k) => !k.startsWith('day:')),
    pill: () => el.querySelector<HTMLElement>('.fresh'),
  };
}

it('follows the head at the top: arrivals are drawn first and no control is offered', async () => {
  const f = feed();
  f.rows([row(2), row(1)]);
  await vi.advanceTimersByTimeAsync(20);
  expect(f.windows().map((w) => w.anchor)).toEqual(['top']);
  f.arrive(row(3), key(2));
  f.count(0);
  expect(f.drawn()).toEqual([key(3), key(2), key(1)]);
  expect(f.pill()?.hidden).toBe(true);
  expect(f.windows()).toHaveLength(1);
});

it('holds a scrolled reader, counts what arrives, and shows it on the way back to the top', async () => {
  const f = feed();
  f.rows([row(2), row(1)]);
  await f.scroll(600);
  expect(f.last()?.anchor).toEqual({ key: key(2) });
  expect(f.last()).toMatchObject({ before: 740, after: 60, liveAbove: true });
  f.rows([row(2), row(1)]);
  f.arrive(row(3), key(2));
  f.arrive(row(4), key(3));
  f.arrive(row(5), key(4));
  f.count(0);
  await vi.advanceTimersByTimeAsync(20);
  expect(f.last()?.anchor).toEqual({ key: key(2) });
  expect(f.drawn()).toEqual([key(5), key(4), key(3), key(2), key(1)]);
  expect(f.el.scrollTop).toBe(600);
  expect(f.pill()?.hidden).toBe(false);
  expect(f.pill()?.textContent).toBe('3 new');

  await f.scroll(0);
  expect(f.last()?.anchor).toBe('top');
  f.rows([row(5), row(4), row(3), row(2), row(1)]);
  f.count(0);
  expect(f.drawn()).toEqual([key(5), key(4), key(3), key(2), key(1)]);
  expect(f.pill()?.hidden).toBe(true);
  const asked = f.windows().length;
  await vi.advanceTimersByTimeAsync(200);
  expect(f.windows()).toHaveLength(asked);
});

it('discloses overflow until a press reloads the head', async () => {
  const f = feed();
  f.rows([row(2), row(1)]);
  await f.scroll(600);
  f.rows([row(5), row(4), row(3), row(2), row(1)], false);
  f.count(1);
  expect(f.pill()?.textContent).toBe('3+ new');
  expect(f.pill()?.getAttribute('aria-label')).toBe(
    'More new notes than this list holds. Press to go to the latest.',
  );
  await f.scroll(0);
  expect(f.last()?.anchor).toEqual({ key: key(2) });
  f.pill()?.click();
  expect(f.last()?.anchor).toBe('top');
  f.rows([row(6), row(5), row(4), row(3), row(2), row(1)]);
  f.count(0);
  expect(f.pill()?.hidden).toBe(true);
  expect(f.pill()?.getAttribute('aria-label')).toBeNull();
});

it('counts an arrival that peeks into view above a keyboard-held row', async () => {
  const f = feed();
  const pane = document.createElement('div');
  pane.className = 'pane cur';
  document.body.append(pane);
  pane.append(f.el);
  f.rows([row(2), row(1)]);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ' }));
  expect(f.el.querySelector('.sel')?.getAttribute('data-key')).toBe(key(2));
  f.rows([row(2), row(1)]);
  f.arrive(row(3), key(2));
  const notes = [...f.el.querySelectorAll('.list > .note')];
  notes.forEach((note, i) => {
    vi.spyOn(note, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, -30 + 45 * i, 390, 45));
  });
  await f.scroll(100);
  expect(f.pill()?.textContent).toBe('1 new');
});

it('pages up at the edge of an older window without jumping past intervening rows', async () => {
  const f = feed();
  Object.defineProperty(f.el, 'scrollHeight', { value: 5000 });
  f.rows([row(12), row(11)], true, false);
  await f.scroll(4600);
  expect(f.last()?.anchor).toEqual({ key: key(12) });
  f.rows([row(12), row(11)], true, false);
  expect(f.last()?.anchor).toEqual({ key: key(11) });
  f.rows([row(9), row(8)], false);
  f.count(3);
  expect(f.pill()?.hidden).toBe(true);

  await f.scroll(0);
  expect(f.last()).toMatchObject({ anchor: { key: key(9) }, before: 60 });
});

it('leaves a replayed screen for the head as soon as the engine counts rows above it', async () => {
  const first = feed();
  first.allow();
  first.rows([row(2), row(1)]);
  await vi.advanceTimersByTimeAsync(250);
  close();

  const f = feed();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.drawn()).toEqual([key(2), key(1)]);
  expect(f.last()?.anchor).toEqual({ key: key(2) });
  f.allow();
  f.rows([row(2), row(1)]);
  f.count(0);
  expect(f.windows()).toHaveLength(1);
  f.count(2);
  expect(f.last()?.anchor).toBe('top');
  expect(f.pill()?.hidden).toBe(true);
  f.rows([row(4), row(3), row(2), row(1)]);
  f.count(0);
  expect(f.drawn()).toEqual([key(4), key(3), key(2), key(1)]);
  expect(f.windows()).toHaveLength(2);
});

it('waits for a hidden tab to come to the front before it follows the head', async () => {
  const first = feed();
  first.allow();
  first.rows([row(2), row(1)]);
  await vi.advanceTimersByTimeAsync(250);
  close();

  const f = feed();
  await vi.advanceTimersByTimeAsync(0);
  f.visible.set(false);
  f.count(2);
  expect(f.windows()).toHaveLength(1);
  expect(f.pill()?.hidden).toBe(true);
  f.visible.set(true);
  expect(f.last()?.anchor).toBe('top');
  expect(f.windows()).toHaveLength(2);
});

it('resumes automatic head after scrolling a warm snapshot during partial hydration', async () => {
  const first = feed();
  first.allow();
  first.rows([row(2), row(1)]);
  await vi.advanceTimersByTimeAsync(250);
  close();

  const f = feed();
  await vi.advanceTimersByTimeAsync(20);
  expect(f.drawn()).toEqual([key(2), key(1)]);
  f.allow();
  f.rows([row(2)], false);
  await f.scroll(600);
  expect(f.windows().map((w) => w.anchor)).toEqual([{ key: key(2) }, { key: key(2) }]);

  // The partial response leaves the warm rows on screen while the reader is scrolled.
  f.rows([row(2)], false);
  f.count(2);
  expect(f.drawn()).toEqual([key(2), key(1)]);
  expect(f.el.scrollTop).toBe(600);
  expect(f.pill()?.hidden).toBe(false);

  await f.scroll(0);
  expect(f.last()?.anchor).toBe('top');
  expect(f.pill()?.hidden).toBe(true);
  await f.scroll(0);
  expect(f.windows()).toHaveLength(3);

  f.rows([row(4), row(3), row(2), row(1)]);
  f.count(0);
  f.arrive(row(5), key(4));
  expect(f.drawn()).toEqual([key(5), key(4), key(3), key(2), key(1)]);
  expect(f.el.scrollTop).toBe(0);
  expect(f.pill()?.hidden).toBe(true);
  expect(f.windows()).toHaveLength(3);
});
