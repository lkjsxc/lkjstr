import { expect, it, vi } from 'vitest';
import { notificationFeed } from './feed-scroll-fixture.ts';

it('reaches the notification head while prepend compensation is pending, without bouncing back a row', async () => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  const f = notificationFeed();
  const height = 60;
  const bar = 34;
  const viewport = 400;
  const rect = (node: HTMLElement) =>
    new DOMRect(
      0,
      bar + [...f.list.children].indexOf(node) * height - f.el.scrollTop + f.shift(),
      390,
      height,
    );
  let scrollTop = 0;
  const writes: number[] = [];
  Object.defineProperties(f.el, {
    scrollTop: {
      get: () => scrollTop,
      set: (value: number) => {
        writes.push(value);
        if (scrollTop === value) return;
        scrollTop = value;
        setTimeout(() => f.el.dispatchEvent(new Event('scroll')), 0);
      },
    },
    clientWidth: { value: 390 },
    clientHeight: { value: viewport },
    scrollHeight: { get: () => bar + f.list.children.length * height },
  });
  Object.defineProperty(f.list, 'offsetHeight', { get: () => f.list.children.length * height });
  vi.spyOn(f.el, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 390, viewport));
  const layout = () => {
    for (const node of f.list.children as HTMLCollectionOf<HTMLElement>)
      node.getBoundingClientRect = () => rect(node);
  };
  // Install geometry before the feed's synchronous settle reads newly inserted rows.
  const insert = f.list.insertBefore.bind(f.list);
  vi.spyOn(f.list, 'insertBefore').mockImplementation((node, before) => {
    const result = insert(node, before);
    layout();
    return result;
  });
  const scroll = async (top: number) => {
    scrollTop = top;
    f.el.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(20);
  };
  try {
    f.rows(20);
    await vi.advanceTimersByTimeAsync(200);
    await scroll(180);
    expect(f.last()).toMatchObject({ anchor: { key: 'notification:20' }, liveAbove: true });
    f.rows(20);
    const anchor = f.list.children[2] as HTMLElement;
    const before = rect(anchor).top;
    f.rows(21);
    expect(f.shift()).toBe(-60);
    expect(rect(anchor).top).toBe(before);
    expect(f.el.scrollTop).toBe(180);
    expect(f.pill().textContent).toBe('1 new');

    await scroll(0);
    expect(f.last()).toMatchObject({ anchor: 'top', headThrough: 'notification:1' });
    f.rows(21, false);
    await vi.advanceTimersByTimeAsync(320);
    expect(f.pill().hidden).toBe(true);
    expect((f.list.firstElementChild as HTMLElement).dataset.key).toBe('notification:21');
    expect({ scroll: f.el.scrollTop, shift: f.shift(), anchor: f.last()?.anchor }).toEqual({
      scroll: 0,
      shift: 0,
      anchor: 'top',
    });
    // Releasing the old anchor must not stop a fling with a programmatic scroll write.
    expect(writes).toEqual([]);
  } finally {
    f.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  }
});
