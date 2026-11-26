import { expect, it, vi } from 'vitest';
import { createKeeper } from '../src/views/feed-place.ts';

it('holds the same viewport offset when scrolling rounds fractional row heights', () => {
  const view = document.createElement('div');
  const list = document.createElement('div');
  const note = document.createElement('article');
  note.dataset.key = 'anchor';
  list.append(note);
  view.append(list);
  document.body.append(view);
  let scroll = 600;
  let layoutTop = 548.25;
  const fraction = () => Number.parseFloat(list.style.translate.split(' ')[1] ?? '0');
  Object.defineProperty(view, 'scrollTop', {
    get: () => scroll,
    set: (value: number) => {
      scroll = Math.round(value);
    },
  });
  vi.spyOn(view, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 390, 600));
  vi.spyOn(note, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, layoutTop - scroll + fraction(), 390, 90),
  );
  const keeper = createKeeper({
    el: view,
    list,
    saved: undefined,
    active: () => true,
    node: () => note,
    anchors: () => true,
    save: () => {},
  });
  try {
    keeper.read();
    const before = note.getBoundingClientRect().top;
    for (let i = 0; i < 8; i++) {
      const restore = keeper.hold();
      layoutTop += 90.375;
      restore();
      expect(note.getBoundingClientRect().top).toBe(before);
      expect(Math.abs(fraction())).toBeLessThanOrEqual(0.5);
    }
  } finally {
    keeper.dispose();
    view.remove();
  }
});

it('never writes the scroll while a fling coasts; rows above that change are made up for at rest', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const view = document.createElement('div');
  const list = document.createElement('div');
  const note = document.createElement('article');
  note.dataset.key = 'anchor';
  list.append(note);
  view.append(list);
  document.body.append(view);
  let scroll = 600;
  let layoutTop = 640;
  const writes: number[] = [];
  Object.defineProperty(view, 'scrollTop', {
    get: () => scroll,
    set: (value: number) => {
      writes.push(value);
      scroll = Math.round(value);
    },
  });
  const shift = () => Number.parseFloat(list.style.translate.split(' ')[1] ?? '0');
  vi.spyOn(view, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 390, 600));
  vi.spyOn(note, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, layoutTop - scroll + shift(), 390, 90),
  );
  const keeper = createKeeper({
    el: view,
    list,
    saved: undefined,
    active: () => true,
    node: () => note,
    anchors: () => true,
    save: () => {},
  });
  try {
    keeper.read();
    view.dispatchEvent(new Event('touchstart'));
    view.dispatchEvent(new Event('touchend'));
    // The fling coasts on: the browser moves the list, no scroll event has been read yet, rows below load.
    scroll += 37;
    view.dispatchEvent(new Event('scroll'));
    expect(keeper.put()).toBe(true);
    keeper.hold()();
    expect(writes).toEqual([]);
    // A row above grows by 50px while it coasts: the rows shift by that much and the scroll is not touched.
    const before = note.getBoundingClientRect().top;
    const settle = keeper.hold();
    layoutTop += 50;
    settle();
    expect(writes).toEqual([]);
    expect(shift()).toBe(-50);
    expect(note.getBoundingClientRect().top).toBe(before);
    // Still coasting: more scroll events, still nothing written.
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(16);
      scroll += 4;
      view.dispatchEvent(new Event('scroll'));
    }
    expect(writes).toEqual([]);
    const moving = note.getBoundingClientRect().top;
    // At rest, the shift goes into the scroll and the screen does not move.
    vi.advanceTimersByTime(400);
    expect(writes).toEqual([657 + 50]);
    expect(shift()).toBe(0);
    expect(note.getBoundingClientRect().top).toBe(moving);
  } finally {
    keeper.dispose();
    view.remove();
    vi.useRealTimers();
  }
});

it('puts a stale place back once the list is still', () => {
  const view = document.createElement('div');
  const list = document.createElement('div');
  const note = document.createElement('article');
  note.dataset.key = 'anchor';
  list.append(note);
  view.append(list);
  document.body.append(view);
  let scroll = 600;
  Object.defineProperty(view, 'scrollTop', {
    get: () => scroll,
    set: (value: number) => void (scroll = Math.round(value)),
  });
  vi.spyOn(view, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 390, 600));
  vi.spyOn(note, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 640 - scroll, 390, 90),
  );
  const keeper = createKeeper({
    el: view,
    list,
    saved: undefined,
    active: () => true,
    node: () => note,
    anchors: () => true,
    save: () => {},
  });
  try {
    keeper.read();
    scroll = 520; // the browser clamped the list after it got shorter: not the reader's doing
    keeper.put();
    expect(scroll).toBe(600);
  } finally {
    keeper.dispose();
    view.remove();
  }
});

it('holds the next visible note when private mutes cover the reading anchor', () => {
  const view = document.createElement('div');
  const list = document.createElement('div');
  const muted = document.createElement('article');
  const visible = document.createElement('article');
  muted.dataset.key = 'muted';
  visible.dataset.key = 'visible';
  list.append(muted, visible);
  view.append(list);
  document.body.append(view);
  let scroll = 600;
  let mutedHeight = 110;
  Object.defineProperty(view, 'scrollTop', {
    get: () => scroll,
    set: (value: number) => void (scroll = value),
  });
  vi.spyOn(view, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 390, 600));
  vi.spyOn(muted, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 580 - scroll, 390, mutedHeight),
  );
  vi.spyOn(visible, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 580 + mutedHeight - scroll, 390, 100),
  );
  const keeper = createKeeper({
    el: view,
    list,
    saved: undefined,
    active: () => true,
    node: (key) => (key === 'muted' ? muted : visible),
    anchors: () => true,
    save: () => {},
  });
  try {
    keeper.read();
    const before = visible.getBoundingClientRect().top;
    const restore = keeper.hold('muted');
    muted.classList.add('hid');
    mutedHeight = 28;
    restore();
    expect(visible.getBoundingClientRect().top).toBe(before);
  } finally {
    keeper.dispose();
    view.remove();
  }
});
