import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import type { FromEngine, Query } from '../src/engine/protocol.ts';

const now = Date.UTC(2026, 10, 15);
let messages: FromEngine[];
let engine: ReturnType<typeof createMockEngine>;
const last = <T extends FromEngine['t']>(t: T) =>
  messages.filter((m): m is Extract<FromEngine, { t: T }> => m.t === t).at(-1);
beforeEach(() => {
  vi.useFakeTimers();
  messages = [];
  engine = createMockEngine(
    (m) => messages.push(m),
    () => now,
  );
  engine.handle({
    t: 'configure',
    config: { language: 'en', heuristics: true, prefetch: false, mock: { live: false } },
  });
});
afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
});
it('counts all Home months and seeks outside the loaded window using the same ordinal map', () => {
  engine.handle({ t: 'open', sub: 's', query: { source: 'home' } });
  engine.handle({ t: 'window', sub: 's', anchor: 'top', before: 0, after: 2 });
  const data = last('timeline')?.timeline;
  expect(data?.supported).toBe(true);
  expect(data?.months.reduce((s, m) => s + m.count, 0)).toBeGreaterThan(100);
  expect(data?.positions).toHaveLength(2);
  const oldest = data?.months.at(-1);
  expect(oldest).toBeDefined();
  engine.handle({
    t: 'window',
    sub: 's',
    anchor: { month: oldest!.at, offset: 0 },
    before: 0,
    after: 2,
  });
  expect(last('rows')?.rows[0]).toMatchObject({ kind: 'note' });
  const row = last('rows')?.rows[0];
  expect(row && 'at' in row && new Date(row.at).getUTCFullYear()).toBe(
    new Date(oldest!.at).getUTCFullYear(),
  );
  expect(last('timeline')?.timeline.positions[0]).toMatchObject({ month: oldest!.at, offset: 0 });
  engine.handle({ t: 'window', sub: 's', anchor: 'top', before: 0, after: 2 });
  expect(last('rows')?.atTop).toBe(true);
});
it('resends exact counts after publish and deletion, releases on close', () => {
  engine.handle({ t: 'open', sub: 's', query: { source: 'home' } });
  engine.handle({ t: 'window', sub: 's', anchor: 'top', before: 0, after: 2 });
  const before = last('timeline')!.timeline.months.reduce((s, m) => s + m.count, 0);
  const as = last('accounts')!.active!;
  engine.handle({
    t: 'act',
    req: 'p',
    action: {
      a: 'publish',
      as,
      what: { k: 'note', draft: { text: 'rail count regression', media: [] } },
    },
  });
  vi.advanceTimersByTime(5000);
  expect(last('timeline')!.timeline.months.reduce((s, m) => s + m.count, 0)).toBe(before + 1);
  const id = last('result')?.id;
  expect(id).toBeDefined();
  engine.handle({
    t: 'act',
    req: 'd',
    action: { a: 'publish', as, what: { k: 'delete', id: id! } },
  });
  vi.advanceTimersByTime(5000);
  expect(last('timeline')!.timeline.months.reduce((s, m) => s + m.count, 0)).toBe(before);
  engine.handle({ t: 'close', sub: 's' });
  const n = messages.length;
  engine.handle({ t: 'window', sub: 's', anchor: 'top', before: 0, after: 2 });
  expect(messages).toHaveLength(n);
});
it('keeps native scrolling for people, threads and unordered profile kinds', () => {
  for (const query of [
    { source: 'thread' },
    { source: 'following' },
    { source: 'profile', show: 'reactions' },
  ] as Query[]) {
    engine.handle({ t: 'open', sub: 's', query });
    expect(last('timeline')?.timeline.supported).toBe(false);
  }
});
