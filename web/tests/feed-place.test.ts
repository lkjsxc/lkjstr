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

it('never writes the scroll while a fling coasts, unless rows above change', () => {
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
    // A row above grows by 50px while it coasts: only that is made up for, from where the reader has got to.
    const before = note.getBoundingClientRect().top;
    const settle = keeper.hold();
    layoutTop += 50;
    settle();
    expect(writes).toEqual([637 + 50]);
    expect(note.getBoundingClientRect().top).toBe(before);
  } finally {
    keeper.dispose();
    view.remove();
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
