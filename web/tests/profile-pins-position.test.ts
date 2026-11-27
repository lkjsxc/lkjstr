import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteRow } from '../src/engine/protocol.ts';
import { loadViewState } from '../src/shared/view-state.ts';
import { newer, pinsFeed } from './profile-pins-fixture.ts';
import { note } from './public-snapshots-support.ts';

const cleanup: (() => void)[] = [];
const observers: { targets: Set<Element>; run: ResizeObserverCallback }[] = [];
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      targets = new Set<Element>();
      constructor(run: ResizeObserverCallback) {
        observers.push({ targets: this.targets, run });
      }
      observe(el: Element) {
        this.targets.add(el);
      }
      unobserve(el: Element) {
        this.targets.delete(el);
      }
      disconnect() {
        this.targets.clear();
      }
    },
  );
});
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  observers.length = 0;
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function resize(target: Element): void {
  for (const observer of observers.filter((o) => o.targets.has(target)))
    observer.run(
      [{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
}
const pinned = (n: number): NoteRow => ({
  ...note(n.toString(16).padStart(64, '0')),
  pinned: true,
});
function geometry(f: ReturnType<typeof pinsFeed>) {
  const root = f.el;
  const list = root.querySelector<HTMLElement>('.list')!;
  const slot = root.querySelector<HTMLElement>('.ppins')!;
  const pinRows = slot.querySelector<HTMLElement>('.pinrows')!;
  const heights = new Map<string, number>();
  let prefix = 180;
  const children = () => [...pinRows.children] as HTMLElement[];
  const height = (el: HTMLElement) => heights.get(el.dataset.key ?? '') ?? 100;
  const pinHeight = () => children().reduce((sum, el) => sum + height(el), 0);
  const headerHeight = () => prefix + pinHeight() + 40;
  const shift = () => Number.parseFloat(list.style.translate.split(' ')[1] ?? '0');
  Object.defineProperties(root, {
    clientHeight: { configurable: true, value: 600 },
    clientWidth: { configurable: true, value: 390 },
    scrollHeight: { configurable: true, get: () => headerHeight() + 600 },
  });
  Object.defineProperty(list, 'offsetHeight', {
    configurable: true,
    get: () => headerHeight() + 240,
  });
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const y = -root.scrollTop + shift();
    if (this === root) return new DOMRect(0, 0, 390, 600);
    if (this === list) return new DOMRect(0, y, 390, headerHeight() + 240);
    if (this === slot.parentElement) return new DOMRect(0, y, 390, headerHeight());
    if (this === pinRows || this === slot) return new DOMRect(0, y + prefix, 390, pinHeight());
    if (this.parentElement === pinRows) {
      const rows = children();
      const before = rows.slice(0, rows.indexOf(this)).reduce((sum, el) => sum + height(el), 0);
      return new DOMRect(0, y + prefix + before, 390, height(this));
    }
    if (this.parentElement === list) {
      const index = this.dataset.key === newer.key ? 0 : 1;
      return new DOMRect(0, y + headerHeight() + index * 120, 390, 120);
    }
    return original.call(this);
  });
  const scroll = (at: number) => {
    root.scrollTop = at;
    root.dispatchEvent(new Event('scroll'));
  };
  const node = (key: string) => children().find((el) => el.dataset.key === key)!;
  return {
    list,
    pinRows,
    heights,
    scroll,
    node,
    headerHeight,
    prefix: (value: number) => {
      prefix = value;
    },
    top: (key: string) => node(key).getBoundingClientRect().top,
  };
}

it('places the first returned pin at the viewport top after next and previous page navigation', () => {
  const f = pinsFeed(cleanup);
  const first = Array.from({ length: 20 }, (_, i) => pinned(i + 1));
  f.rows('pins', first, true, false);
  const g = geometry(f);
  g.scroll(1980);
  const button = (text: string) =>
    [...f.el.querySelectorAll<HTMLButtonElement>('.pinpages button')].find(
      (el) => el.textContent === text,
    )!;
  button('Next pinned notes').click();
  const second = [first[19]!, ...Array.from({ length: 19 }, (_, i) => pinned(i + 21))];
  f.rows('pins', second, false, true);
  expect(g.top(second[0]!.key)).toBe(0);
  resize(g.list); // The ordinary header keeper must not undo the local page placement.
  expect(g.top(second[0]!.key)).toBe(0);

  g.scroll(1180);
  button('Previous pinned notes').click();
  f.rows('pins', first, true, false);
  expect(g.top(first[0]!.key)).toBe(0);
  resize(g.list);
  expect(g.top(first[0]!.key)).toBe(0);
});

it('keeps the visible pin through inserted references and later height changes above it', async () => {
  const f = pinsFeed(cleanup);
  const original = [pinned(1), pinned(2), pinned(3), pinned(4)];
  f.rows('pins', original);
  const g = geometry(f);
  g.scroll(300);
  const reading = original[1]!.key;
  const before = g.top(reading);
  f.rows('pins', [pinned(5), ...original]);
  expect(g.top(reading)).toBe(before);
  resize(g.list);
  expect(g.top(reading)).toBe(before);
  g.heights.set(pinned(5).key, 180);
  resize(g.list);
  resize(g.pinRows);
  expect(g.top(reading)).toBe(before);
  resize(g.list);
  expect(g.top(reading)).toBe(before);
  expect(f.el.scrollTop).toBe(300); // A recent gesture uses the existing keeper's shift, not a scroll write.
  await vi.advanceTimersByTimeAsync(200);
  expect(g.top(reading)).toBe(before);
});

it('leaves chronology in charge when a taller pins section grows above the reading note', async () => {
  const f = pinsFeed(cleanup);
  f.rows('pins', [pinned(1), pinned(2), pinned(3)]);
  const g = geometry(f);
  g.scroll(g.headerHeight() + 20);
  await vi.advanceTimersByTimeAsync(200);
  const chronology = [...g.list.children].find(
    (el) => (el as HTMLElement).dataset.key === newer.key,
  )!;
  const before = chronology.getBoundingClientRect().top;
  g.heights.set(pinned(1).key, 200);
  resize(g.pinRows); // Pin geometry can arrive before the outer observer's delivery.
  resize(g.list);
  resize(g.pinRows);
  expect(chronology.getBoundingClientRect().top).toBe(before);
  await vi.advanceTimersByTimeAsync(350);
  expect(loadViewState<{ pos?: { key: string } }>(f.env.instance).pos?.key).toBe(newer.key);
});

it('restores a pin after the profile biography changes without persisting a pin key as chronology', async () => {
  const f = pinsFeed(cleanup);
  f.rows('pins', [pinned(1), pinned(2), pinned(3), pinned(4)]);
  const g = geometry(f);
  g.scroll(300);
  const before = g.top(pinned(2).key);
  f.receive({
    t: 'patch',
    sub: f.sub('profile'),
    ops: [{ op: 'update', row: { ...f.profile, followers: 4 } }],
  });
  g.prefix(260);
  resize(f.el.querySelector('.ppins')!.parentElement!);
  resize(g.list);
  expect(g.top(pinned(2).key)).toBe(before);
  await vi.advanceTimersByTimeAsync(350);
  expect(loadViewState<{ pos?: { key: string } }>(f.env.instance).pos?.key).toBe(f.profile.key);
});
