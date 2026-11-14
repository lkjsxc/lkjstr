import { describe, expect, it, vi } from 'vitest';
import { hold, UNDO_MS, unhold, withHeld } from '../src/views/held.ts';
import { parseClosed } from '../src/wm/closed.ts';

describe('undo', () => {
  const row = {
    id: 'n1',
    mine: { reposted: false },
    counts: { reposts: 2, reactions: 1 },
    reactions: [{ emoji: '🎉', count: 1, mine: false }],
  } as unknown as Parameters<typeof withHeld>[0];
  it('a like or repost taken back in time was never sent; left alone it is sent once', async () => {
    vi.useFakeTimers();
    const sent: unknown[] = [];
    const act = (a: unknown) => (sent.push(a), Promise.resolve({ ok: true } as never));
    hold('n1', 'me', { k: 'repost' }, act, () => undefined);
    hold('n1', 'me', { k: 'reaction', emoji: '🎉' }, act, () => undefined);
    const shown = withHeld(row);
    expect([shown.mine.reposted, shown.counts.reposts, shown.counts.reactions]).toEqual([
      true,
      3,
      2,
    ]);
    expect(shown.reactions).toEqual([{ emoji: '🎉', count: 2, mine: true }]);
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(unhold('n1', { k: 'repost' })).toBe(true);
    expect(withHeld(row).mine.reposted).toBe(false);
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(sent).toEqual([
      { a: 'publish', as: 'me', what: { k: 'reaction', id: 'n1', emoji: '🎉', url: undefined } },
    ]);
    expect(unhold('n1', { k: 'reaction', emoji: '🎉' })).toBe(false);
    expect(withHeld(row)).toBe(row);
    // Leaving the page sends what still waits, once.
    hold('n1', 'me', { k: 'repost' }, act, () => undefined);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(sent.length).toBe(2);
    vi.useRealTimers();
  });
  it('the stored list of closed tabs keeps only what can be opened', () => {
    const ok = { kind: 'thread', state: { id: 'x' }, pane: 'p1', index: 1 };
    expect(parseClosed([ok, { ...ok, kind: 'gone' }, { ...ok, index: -1 }, null, 3])).toEqual([ok]);
    expect(parseClosed('x')).toEqual([]);
  });
});
