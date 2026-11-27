import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readNoteState } from '../src/shared/note-state.ts';
import { createKeeper } from '../src/views/feed-place.ts';
import { newer, older, pins, pinsFeed } from './profile-pins-fixture.ts';
import { account, PUBKEY, tick } from './vault-ui-fixture.ts';

const cleanup: (() => void)[] = [];
const feed = (version = 18, visible = true) => pinsFeed(cleanup, version, visible);
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('keeps public pin tag order above the ordinary profile order and outside chronological anchors', () => {
  const f = feed();
  f.rows('pins', pins);
  const slot = f.el.querySelector<HTMLElement>('.ppins')!;
  const list = f.el.querySelector<HTMLElement>('.list')!;
  const main = [...list.children].filter((el) => el.classList.contains('note')) as HTMLElement[];
  const pinned = [...slot.querySelectorAll<HTMLElement>('.pinrows > [data-key]')];
  expect(pinned.map((el) => el.dataset.key)).toEqual([older.key, newer.key]);
  expect(main.map((el) => el.dataset.key)).toEqual([newer.key, older.key]);
  expect(slot.compareDocumentPosition(main[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(slot.hidden).toBe(false);
  expect(slot.querySelectorAll('.pinmark')).toHaveLength(2);

  f.el.scrollTop = 500;
  f.el.getBoundingClientRect = () => new DOMRect(0, 0, 390, 600);
  for (const child of list.children)
    child.getBoundingClientRect = () => new DOMRect(0, -100, 390, 20);
  main.forEach((el, i) => {
    el.getBoundingClientRect = () => new DOMRect(0, 10 + i * 100, 390, 100);
  });
  pinned[0]!.getBoundingClientRect = () => new DOMRect(0, 1, 390, 20);
  const keeper = createKeeper({
    el: f.el,
    list,
    saved: undefined,
    active: () => true,
    save() {},
    node: (key) => main.find((el) => el.dataset.key === key),
    anchors: (key) => !key.startsWith('day:'),
  });
  cleanup.push(() => keeper.dispose());
  keeper.read();
  expect(keeper.get()).toEqual({ key: newer.key, off: 10 });
});

it('retains pinned audio and its state listeners across a profile metadata redraw', () => {
  const f = feed();
  const audioRow = {
    ...pins[0]!,
    media: [{ type: 'audio' as const, url: 'https://example.test/pinned.mp3' }],
  };
  f.rows('pins', [audioRow]);
  const slot = f.el.querySelector('.ppins')!;
  const oldHeader = slot.parentElement!;
  const audio = slot.querySelector('audio')!;
  Object.defineProperties(audio, { readyState: { value: 1 }, duration: { value: 120 } });
  audio.currentTime = 12;
  audio.dispatchEvent(new Event('seeked'));
  const pauses = vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length;
  f.receive({
    t: 'patch',
    sub: f.sub('profile'),
    ops: [{ op: 'update', row: { ...f.profile, followers: 2 } }],
  });
  expect(oldHeader.isConnected).toBe(false);
  expect(f.el.querySelector('.ppins')).toBe(slot);
  expect(slot.querySelector('audio')).toBe(audio);
  expect(audio.src).toBe('https://example.test/pinned.mp3');
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(pauses);
  audio.currentTime = 26;
  audio.dispatchEvent(new Event('seeked'));
  expect(readNoteState(f.env.instance, audioRow.id).audio?.['0']).toBe(26);
});

it('owns visibility, account-scoped reopening, and final close for its separate subscription', async () => {
  const f = feed();
  const first = f.sub('pins');
  expect(f.sent).toContainEqual({
    t: 'open',
    visible: false,
    sub: first,
    query: { source: 'pins', pubkey: PUBKEY, account: PUBKEY },
  });
  await tick();
  expect(f.sent.findLast((m) => m.t === 'hint')).toMatchObject({
    hint: { visibleSubs: expect.arrayContaining([first]) },
  });
  f.visible.set(false);
  await tick();
  expect(f.sent.findLast((m) => m.t === 'hint')).toMatchObject({ hint: { visibleSubs: [] } });
  f.visible.set(true);
  await tick();
  expect(f.sent.findLast((m) => m.t === 'hint')).toMatchObject({
    hint: { visibleSubs: expect.arrayContaining([first]) },
  });

  const other = account({ author: { ...account().author, pubkey: 'c'.repeat(64) } });
  f.receive({ t: 'accounts', active: other.author.pubkey, accounts: [account(), other] });
  expect(f.sent).toContainEqual({ t: 'close', sub: first });
  const second = f.sub('pins');
  expect(second).not.toBe(first);
  expect(f.sent).toContainEqual({
    t: 'open',
    visible: false,
    sub: second,
    query: { source: 'pins', pubkey: PUBKEY, account: other.author.pubkey },
  });
  f.close();
  expect(f.sent).toContainEqual({ t: 'close', sub: second });
});

it('uses finite pages without a retained chronology window', () => {
  const f = feed();
  const pinSub = f.sub('pins');
  expect(f.sent).toContainEqual({
    t: 'window',
    sub: pinSub,
    anchor: 'top',
    before: 0,
    after: 20,
  });
  f.rows('pins', pins, true, false);
  const button = (name: string) =>
    [...f.el.querySelectorAll<HTMLButtonElement>('.pinpages button')].find(
      (el) => el.textContent === name,
    )!;
  button('Next pinned notes').click();
  expect(f.sent.at(-1)).toEqual({
    t: 'window',
    sub: pinSub,
    anchor: { key: newer.key },
    before: 0,
    after: 21,
  });
  f.rows('pins', pins, false, true);
  button('Previous pinned notes').click();
  expect(f.sent.at(-1)).toEqual({
    t: 'window',
    sub: pinSub,
    anchor: { key: older.key },
    before: 20,
    after: 1,
    liveAbove: true,
  });
});

it('does not request pins from an engine predating the public list contract', () => {
  const f = feed(17);
  expect(f.sent.some((m) => m.t === 'open' && m.query.source === 'pins')).toBe(false);
  expect(f.el.querySelector<HTMLElement>('.ppins')?.hidden).toBe(true);
});

it('keeps loading after a list arrives until its delayed referenced note is drawn', () => {
  const f = feed();
  const slot = f.el.querySelector<HTMLElement>('.ppins')!;
  f.rows('pins', [], true, false);
  f.receive({
    t: 'state',
    sub: f.sub('pins'),
    state: {
      phase: 'live',
      relaysAsked: 2,
      relaysAnswered: 1,
      pins: { pending: 1, unavailable: 0 },
    },
  });
  expect(slot.hidden).toBe(false);
  expect(slot.querySelector('[role="status"]')?.textContent).toBe('Loading pinned notes…');
  f.rows('pins', [pins[0]!]);
  f.receive({
    t: 'state',
    sub: f.sub('pins'),
    state: {
      phase: 'live',
      relaysAsked: 2,
      relaysAnswered: 2,
      pins: { pending: 0, unavailable: 0 },
    },
  });
  expect(slot.hidden).toBe(false);
  expect(slot.querySelector('.pinrows > [data-key]')?.getAttribute('data-key')).toBe(older.key);
  expect(slot.querySelector<HTMLElement>('[role="status"]')?.hidden).toBe(true);
});

it('distinguishes unavailable targets and failed reads from a completed empty list', () => {
  const f = feed();
  const slot = f.el.querySelector<HTMLElement>('.ppins')!;
  f.rows('pins', []);
  const state = (phase: 'live' | 'failed', unavailable: number) =>
    f.receive({
      t: 'state',
      sub: f.sub('pins'),
      state: { phase, relaysAsked: 1, relaysAnswered: 1, pins: { pending: 0, unavailable } },
    });
  state('live', 1);
  expect(slot.hidden).toBe(false);
  expect(slot.querySelector('[role="status"]')?.textContent).toBe(
    'Some pinned notes are unavailable.',
  );
  state('failed', 1);
  expect(slot.querySelector('[role="status"]')?.textContent).toBe(
    'Pinned notes could not be loaded.',
  );
  state('live', 0);
  expect(slot.hidden).toBe(true);
});

it('opens hidden pins atomically and activates them only when the profile becomes visible', async () => {
  const f = feed(18, false);
  const sub = f.sub('pins');
  expect(f.sent.find((m) => m.t === 'open' && m.sub === sub)).toMatchObject({ visible: false });
  await tick();
  expect(f.sent.some((m) => m.t === 'hint' && m.hint.visibleSubs.includes(sub))).toBe(false);
  f.visible.set(true);
  await tick();
  expect(f.sent.findLast((m) => m.t === 'hint')).toMatchObject({
    hint: { visibleSubs: expect.arrayContaining([sub]) },
  });
});

it('restores focused pin controls after both unrelated and header redraws without scrolling', () => {
  const f = feed();
  f.rows('pins', pins);
  const button = f.el.querySelector<HTMLButtonElement>('.pinrows .a-more')!;
  button.focus();
  const focus = vi.spyOn(button, 'focus');
  for (const row of [
    { ...newer, counts: { ...newer.counts, replies: 9 } },
    { ...f.profile, followers: 3 },
  ]) {
    f.receive({ t: 'patch', sub: f.sub('profile'), ops: [{ op: 'update', row }] });
    expect(document.activeElement).toBe(button);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
  }
});

it('keeps pin controls mounted when only the saved account metadata changes', () => {
  const f = feed();
  f.rows('pins', pins);
  const button = f.el.querySelector('.pinrows .a-more');
  const named = account({ author: { ...account().author, name: 'A newer account name' } });
  f.receive({ t: 'accounts', active: PUBKEY, accounts: [named] });
  expect(f.el.querySelector('.pinrows .a-more')).toBe(button);
  f.receive({ t: 'accounts', active: PUBKEY, accounts: [{ ...named, signer: 'none' }] });
  expect(f.el.querySelector('.pinrows .a-more')).not.toBe(button);
});
