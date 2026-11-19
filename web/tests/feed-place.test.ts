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
