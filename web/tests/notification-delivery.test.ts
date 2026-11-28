import { expect, it, vi } from 'vitest';
import type { NotificationRow } from '../src/engine/protocol.ts';
import { notificationFeed } from './feed-scroll-fixture.ts';

it('draws notification arrivals before relay completion or target and profile hydration', () => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  let f: ReturnType<typeof notificationFeed> | undefined;
  try {
    f = notificationFeed();
    f.state({ phase: 'cache', relaysAsked: 1, relaysAnswered: 0 });
    f.rows(20, false);
    expect(f.list.children).toHaveLength(20);
    const retained = f.list.firstElementChild;
    const actor = { pubkey: 'b'.repeat(64), npub: 'npub1pending', name: '' };
    const arrival: NotificationRow = {
      kind: 'notification',
      key: 'notification:21',
      type: 'reaction',
      at: 21_000,
      actors: [actor],
      others: 0,
      unread: true,
    };

    // No timer turn, relay completion, target, or actor profile has arrived.
    f.patch([{ op: 'insert', before: 'notification:20', rows: [arrival] }]);
    expect(f.list.children).toHaveLength(21);
    const first = f.list.firstElementChild as HTMLElement;
    expect(first.dataset.key).toBe(arrival.key);
    expect(first.classList.contains('unread')).toBe(true);
    expect(first.querySelector('.nwho')?.textContent).toMatch(/\S/);
    expect(f.list.children[1]).toBe(retained);
    expect(f.pill().hidden).toBe(true);
    expect(f.el.scrollTop).toBe(0);

    f.patch([
      {
        op: 'update',
        row: {
          ...arrival,
          actors: [{ ...actor, name: 'Resolved actor' }],
          target: { id: 'c'.repeat(64), excerpt: 'Resolved target', media: 0 },
        },
      },
    ]);
    expect(f.list.firstElementChild?.textContent).toContain('Resolved actor');
    expect(f.list.firstElementChild?.textContent).toContain('Resolved target');
    expect(f.list.children[1]).toBe(retained);
    expect(f.pill().hidden).toBe(true);
  } finally {
    f?.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  }
});
