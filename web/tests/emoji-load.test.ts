import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type Watcher = {
  readonly calls: (entries: { target: Element; isIntersecting: boolean }[]) => void;
  readonly seen: Set<Element>;
};
const watchers: Watcher[] = [];
beforeAll(() => {
  vi.useFakeTimers();
  // A stand-in observer: it remembers what it watches, and the test says what is in view.
  vi.stubGlobal('IntersectionObserver', function (this: object, calls: Watcher['calls']) {
    const seen = new Set<Element>();
    watchers.push({ calls, seen });
    return { observe: (e: Element) => seen.add(e), unobserve: (e: Element) => seen.delete(e) };
  });
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => setTimeout(f, 0));
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const inView = () => {
  const view = document.createElement('div');
  view.className = 'view';
  document.body.append(view);
  return view;
};

describe('custom emoji in text', () => {
  it('holds a square box and asks for its picture only when its row comes near', async () => {
    const { inlineEmoji } = await import('../src/views/emoji-load.ts');
    const img = inlineEmoji(':cat:', 'https://e.test/cat.png', true) as HTMLImageElement;
    inView().append(img);
    vi.advanceTimersByTime(1);
    expect(img.style.width).toBe('1.25em');
    expect(img.getAttribute('src')).toMatch(/^data:image\/gif/);
    const ahead = watchers.find((w) => w.seen.has(img));
    ahead?.calls([{ target: img, isIntersecting: true }]);
    expect(img.getAttribute('src')).toBe('https://e.test/cat.png');
  });
  it('keeps the box of a picture that fails in view; the code takes its width out of sight', async () => {
    const { inlineEmoji } = await import('../src/views/emoji-load.ts');
    const img = inlineEmoji(':dog:', 'https://e.test/dog.png', false) as HTMLImageElement;
    const view = inView();
    view.append(img);
    vi.advanceTimersByTime(1);
    img.dispatchEvent(new Event('error'));
    const text = view.querySelector<HTMLElement>('.efail');
    expect(text?.classList.contains('held')).toBe(true);
    expect(text?.textContent).toBe(':dog:');
    const sight = watchers.find((w) => text && w.seen.has(text));
    sight?.calls([{ target: text as Element, isIntersecting: true }]);
    expect(text?.classList.contains('held')).toBe(true);
    sight?.calls([{ target: text as Element, isIntersecting: false }]);
    expect(text?.classList.contains('held')).toBe(false);
    expect(text?.style.width).toBe('');
  });
  it('lets go of a waiting emoji whose row has gone, though no new emoji is made', async () => {
    const { inlineEmoji, watchedEmoji } = await import('../src/views/emoji-load.ts');
    const img = inlineEmoji(':owl:', 'https://e.test/owl.png', false);
    inView().append(img);
    vi.advanceTimersByTime(1);
    expect(watchers.some((w) => w.seen.has(img))).toBe(true);
    img.remove();
    vi.advanceTimersByTime(10_000);
    expect(watchers.some((w) => w.seen.has(img))).toBe(false);
    expect(watchedEmoji()).toBe(0);
  });
});
