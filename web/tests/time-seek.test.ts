// Jumps on the time rail (interface-time.md C3): one seek out at a time, at most one per 80ms, the latest target
// waiting; a late answer never pulls the list back; the return tick goes to the exact row and offset.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Anchor, Timeline } from '../src/engine/protocol.ts';
import type { Place } from '../src/views/feed-place.ts';
import type { TimePlace } from '../src/views/time-scale.ts';
import { createSeeker } from '../src/views/time-seek.ts';

const month = Date.UTC(2026, 10);
const at = (offset: number): TimePlace => ({ month, offset });
const name = (p: TimePlace): string => `n${p.offset}`;

function harness(drawn: number[]) {
  const loaded = new Set(drawn);
  const scrolled: (string | Place)[] = [];
  const seeks: { anchor: Anchor; at: number }[] = [];
  let landed = 0;
  const seeker = createSeeker({
    scrollTo: (p, saved) => loaded.has(p.offset) && (scrolled.push(saved ?? name(p)), true),
    seek: (anchor) => void seeks.push({ anchor, at: performance.now() }),
    current: () => ({ time: at(1), place: { key: 'n1', off: -12 } }),
    sent: () => undefined,
    landed: () => void landed++,
    sync: () => undefined,
  });
  /** The engine answers the last seek with a window around `offset` (an evicted target: around `nearest`). */
  const answer = (_offset: number, nearest = _offset): void => {
    loaded.clear();
    for (const o of [nearest - 1, nearest, nearest + 1]) loaded.add(o);
    seeker.window();
    const data = {
      supported: true,
      months: [{ at: month, count: 100 }],
      positions: [nearest - 1, nearest, nearest + 1].map((o) => ({
        key: `n${o}`,
        month,
        offset: o,
      })),
      anchor: `n${nearest}`, // the engine anchors on the nearest retained row
      newest: month,
      oldest: month,
      older: false,
    } satisfies Timeline;
    seeker.timeline(data);
    seeker.settle(data);
  };
  return { seeker, scrolled, seeks, answer, landed: () => landed };
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
afterEach(() => vi.useRealTimers());

it('scrolls to a loaded target at once and leaves the tick where it started', () => {
  const x = harness([1, 2, 3]);
  x.seeker.go(at(3));
  expect(x.scrolled).toEqual(['n3']);
  expect(x.seeks).toEqual([]);
  expect(x.seeker.s.back?.place).toEqual({ key: 'n1', off: -12 });
  expect(x.landed()).toBe(1);
});

it('sends one seek at a time, at most every 80ms, and ends on the last target', () => {
  const x = harness([1]);
  x.seeker.go(at(40));
  vi.advanceTimersByTime(10);
  x.seeker.go(at(50)); // waits for the answer to the first
  x.seeker.go(at(60)); // replaces it: only the latest waits
  expect(x.seeks.map((s) => s.anchor)).toEqual([{ month, offset: 40, returnKey: 'n1' }]);
  vi.advanceTimersByTime(20);
  x.answer(40);
  expect(x.scrolled).toEqual(['n40']);
  expect(x.landed()).toBe(0); // not landed: a newer target is on its way
  vi.advanceTimersByTime(49);
  expect(x.seeks).toHaveLength(1); // 79ms after the first
  vi.advanceTimersByTime(1);
  expect(x.seeks.map((s) => s.anchor)).toEqual([
    { month, offset: 40, returnKey: 'n1' },
    { month, offset: 60, returnKey: 'n1' },
  ]);
  expect(x.seeks[1]!.at - x.seeks[0]!.at).toBeGreaterThanOrEqual(80);
  x.answer(60);
  expect(x.scrolled.at(-1)).toBe('n60');
  expect(x.landed()).toBe(1);
  expect(x.seeker.s.pending).toBeUndefined();
});

it('never scrolls back to an earlier target that was answered late', () => {
  const x = harness([1, 2]);
  x.seeker.go(at(40)); // out
  x.seeker.go(at(2)); // loaded now, but waits: the answer to 40 is about to replace the window
  expect(x.scrolled).toEqual([]);
  x.answer(40);
  vi.advanceTimersByTime(80);
  expect(x.seeks.map((s) => s.anchor)).toEqual([
    { month, offset: 40, returnKey: 'n1' },
    { month, offset: 2, returnKey: 'n1' },
  ]);
  x.answer(2);
  x.seeker.settle(undefined); // nothing older comes back later
  expect(x.scrolled).toEqual(['n40', 'n2']);
  expect(x.landed()).toBe(1);
});

it('lands on the nearest row when the target was evicted meanwhile', () => {
  const x = harness([1]);
  x.seeker.go(at(40));
  x.answer(40, 37);
  expect(x.scrolled).toEqual(['n37']);
  expect(x.landed()).toBe(1);
});

it('returns to the exact row and offset, by scroll or by seek', () => {
  const near = harness([1, 2, 3]);
  near.seeker.go(at(3));
  expect(near.seeker.ret()).toBe(true);
  expect(near.scrolled.at(-1)).toEqual({ key: 'n1', off: -12 });
  expect(near.seeker.s.back).toBeUndefined();
  expect(near.seeker.ret()).toBe(false);
  const far = harness([1]);
  far.seeker.go(at(40));
  far.answer(40); // the window around 40 no longer holds n1
  expect(far.seeker.ret()).toBe(true);
  expect(far.seeks.at(-1)?.anchor).toEqual({ key: 'n1' });
  far.answer(1);
  expect(far.scrolled.at(-1)).toEqual({ key: 'n1', off: -12 });
  expect(far.seeker.s.back).toBeUndefined();
});
