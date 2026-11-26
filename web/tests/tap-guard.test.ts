import { afterEach, expect, it, vi } from 'vitest';
import { guardTaps } from '../src/views/tap-guard.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A tile with two rows, each with a button; `tops` says where each row is drawn. */
function scene() {
  let observed: (() => void) | undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(f: () => void) {
        observed = f;
      }
      observe(): void {}
      disconnect(): void {}
    },
  );
  const view = document.createElement('div');
  const list = document.createElement('div');
  const tops: Record<string, number> = { a: 0, b: 100 };
  const rows = ['a', 'b'].map((key) => {
    const row = document.createElement('article');
    row.className = 'note';
    row.dataset.key = key;
    const button = document.createElement('button');
    row.append(button);
    list.append(row);
    vi.spyOn(row, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, tops[key] ?? 0, 390, 90),
    );
    vi.spyOn(button, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, (tops[key] ?? 0) + 60, 40, 28),
    );
    return { row, button };
  });
  view.append(list);
  document.body.append(view);
  vi.spyOn(view, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 390, 600));
  const off = guardTaps(view, list);
  const clicks: string[] = [];
  for (const [i, r] of rows.entries())
    r.button.addEventListener('click', () => clicks.push(['a', 'b'][i] ?? ''));
  const tap = (el: Element, pointerType = 'touch'): void => {
    el.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerType }),
    );
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  const resized = (): void => observed?.();
  return { view, rows, tops, tap, resized, clicks, off };
}

it('lets a press go that lands on a control the rows just moved under the finger', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const s = scene();
  try {
    s.resized(); // first look: everything noted where it is
    s.tops.b = 140; // row a grew (a reaction): row b and its button moved down
    s.resized();
    s.tap(s.rows[1]?.button as Element);
    s.tap(s.rows[0]?.button as Element); // row a's own button stayed put
    expect(s.clicks).toEqual(['a']);
    vi.advanceTimersByTime(450); // a moment later the same press works
    s.tap(s.rows[1]?.button as Element);
    expect(s.clicks).toEqual(['a', 'b']);
  } finally {
    s.off();
    s.view.remove();
  }
});

it('never counts the reader scrolling as a move', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const s = scene();
  try {
    s.resized();
    Object.defineProperty(s.view, 'scrollTop', { value: 200, configurable: true });
    s.tops.a = -200;
    s.tops.b = -100;
    s.view.dispatchEvent(new Event('scroll'));
    s.resized(); // rows load below while the list moves
    s.tap(s.rows[1]?.button as Element);
    expect(s.clicks).toEqual(['b']);
  } finally {
    s.off();
    s.view.remove();
  }
});

it('lets the reader press a moved control after scrolling to its new place', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const s = scene();
  try {
    s.resized();
    s.tops.b = 140;
    s.resized();
    Object.defineProperty(s.view, 'scrollTop', { value: 25 });
    s.tops.a = -25;
    s.tops.b = 115;
    s.view.dispatchEvent(new Event('scroll'));
    s.tap(s.rows[1]?.button as Element);
    expect(s.clicks).toEqual(['b']);
  } finally {
    s.off();
    s.view.remove();
  }
});

it('lets a mouse click reach its target after the rows move', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const s = scene();
  try {
    s.resized();
    s.tops.b = 140;
    s.resized();
    s.tap(s.rows[1]?.button as Element, 'mouse');
    expect(s.clicks).toEqual(['b']);
  } finally {
    s.off();
    s.view.remove();
  }
});

it('keeps the inline reply form usable when the notes move', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const s = scene();
  try {
    s.rows[1]!.row.className = 'tsay compose';
    s.resized();
    s.tops.a = 40;
    s.tops.b = 140;
    s.resized();
    s.tap(s.rows[0]!.button);
    s.tap(s.rows[1]!.button);
    expect(s.clicks).toEqual(['b']);
  } finally {
    s.off();
    s.view.remove();
  }
});

it('leaves alone a press on rows that came into a list where nothing moved', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const s = scene();
  try {
    const [a, b] = s.rows;
    a?.row.remove();
    b?.row.remove();
    s.resized(); // the list is empty
    s.view.querySelector('div')?.append(a?.row as Element, b?.row as Element);
    s.resized(); // the first rows arrive
    s.tap(b?.button as Element);
    expect(s.clicks).toEqual(['b']);
  } finally {
    s.off();
    s.view.remove();
  }
});
