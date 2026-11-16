import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { SELF } from '../src/engine/mock/people.ts';
import { applyOps } from '../src/engine/ops.ts';
import type { FromEngine, Query, Row } from '../src/engine/protocol.ts';
import { feedWindow } from '../src/views/feed-window.ts';

const NOW = Date.UTC(2026, 10, 16, 15);
let engine: MockEngine;
let messages: FromEngine[];
let rows: Map<string, Row[]>;
let serial: number;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  messages = [];
  rows = new Map();
  serial = 0;
  engine = createMockEngine((message) => {
    messages.push(structuredClone(message));
    if (message.t === 'rows') rows.set(message.sub, [...message.rows]);
    if (message.t === 'patch')
      rows.set(message.sub, applyOps(rows.get(message.sub) ?? [], message.ops));
  });
  engine.handle({
    t: 'configure',
    config: { language: 'en', heuristics: true, prefetch: true, mock: { live: false } },
  });
});
afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
});
const publish = (text: string): void => {
  engine.handle({
    t: 'act',
    req: `post-${serial++}`,
    action: { a: 'publish', as: SELF.author.pubkey, what: { k: 'note', draft: { text } } },
  });
  vi.advanceTimersByTime(3000);
};
const open = (query: Query = { source: 'search', text: 'example' }): void => {
  engine.handle({ t: 'open', sub: 'search', query: { since: NOW, ...query } });
  engine.handle({ t: 'window', sub: 'search', anchor: 'top', before: 0, after: 3 });
};
const of = <T extends FromEngine['t']>(kind: T): Extract<FromEngine, { t: T }>[] =>
  messages
    .filter((m): m is Extract<FromEngine, { t: T }> => m.t === kind)
    .filter((m) => 'sub' in m && m.sub === 'search');
const shown = (): Row[] => rows.get('search') ?? [];
const people = (): Row[] => shown().filter((r) => r.kind === 'person');
const notes = (): Row[] => shown().filter((r) => r.kind === 'note');
const fresh = (): number => of('fresh').at(-1)?.count ?? 0;
const mute = (pubkey: string): void => {
  engine.handle({
    t: 'act',
    req: `mute-${serial++}`,
    action: { a: 'mute', as: SELF.author.pubkey, target: { k: 'person', pubkey }, on: true },
  });
  vi.advanceTimersByTime(3000);
};

it('matching people precede a complete note budget and never enter time-rail counts', () => {
  for (let i = 0; i < 5; i++) publish(`example record ${i}`);
  open();
  expect(people()).toHaveLength(6);
  expect(notes()).toHaveLength(3);
  expect(
    shown()
      .slice(0, 6)
      .every((r) => r.kind === 'person'),
  ).toBe(true);
  expect(people().every((r) => r.key.startsWith('search-person:'))).toBe(true);
  const rail = of('timeline').at(-1)?.timeline;
  expect(rail?.supported).toBe(true);
  expect(rail?.months.reduce((n, m) => n + m.count, 0)).toBe(5);
  expect(rail?.positions.map((p) => p.key)).toEqual(notes().map((r) => r.key));
  expect(feedWindow('search', shown())).toEqual({
    first: notes()[0]?.key,
    last: notes().at(-1)?.key,
    count: 3,
  });
  expect(feedWindow('people', people()).count).toBe(6);
  for (const after of [0, 1, 2]) {
    engine.handle({ t: 'window', sub: 'search', anchor: 'top', before: 0, after });
    expect(notes()).toHaveLength(Math.max(1, after));
    expect(people()).toHaveLength(6);
  }
});

it('all normalized words can match different name fields and person mutes apply before six', () => {
  open({ source: 'search', text: 'ＬＥＮＡ example' });
  expect(people()).toHaveLength(1);
  const match = people()[0];
  expect(match?.kind === 'person' && match.author.name).toBe('Lena Fischer');
  open();
  expect(people()).toHaveLength(6);
  const target = people().find((r) => r.kind === 'person' && !r.self);
  if (target?.kind !== 'person') throw new Error('missing person fixture');
  mute(target.author.pubkey);
  expect(people()).toHaveLength(6);
  expect(people().some((r) => r.key === target.key)).toBe(false);
  expect(fresh()).toBe(0);
});

it('a live note inserts after the unchanged people prefix', () => {
  publish('example original');
  open();
  const header = people().map((r) => r.key);
  publish('example incoming');
  expect(
    shown()
      .slice(0, header.length)
      .map((r) => r.key),
  ).toEqual(header);
  const first = notes()[0];
  expect(first?.kind === 'note' && first.segments[0]).toEqual({
    k: 'text',
    text: 'example incoming',
  });
  expect(new Set(shown().map((r) => r.key)).size).toBe(shown().length);
  expect(fresh()).toBe(0);
});

it('holding the first note removes the prefix only when an actual newer note arrives', () => {
  for (let i = 0; i < 4; i++) publish(`example held ${i}`);
  open();
  const header = people()[0]?.key ?? '';
  const held = notes().map((r) => r.key);
  engine.handle({
    t: 'window',
    sub: 'search',
    anchor: { key: header },
    before: 0,
    after: 3,
  });
  expect(people()).toHaveLength(6);
  expect(notes().map((r) => r.key)).toEqual(held);
  publish('example newer');
  expect(people()).toEqual([]);
  expect(notes().map((r) => r.key)).toEqual(held);
  expect(fresh()).toBe(1);
  const target = of('rows')
    .flatMap((m) => m.rows)
    .find((r) => r.kind === 'person' && !r.self);
  if (target?.kind !== 'person') throw new Error('missing person fixture');
  mute(target.author.pubkey);
  expect(people()).toEqual([]);
  expect(notes().map((r) => r.key)).toEqual(held);
  expect(fresh()).toBe(1);
  engine.handle({ t: 'window', sub: 'search', anchor: 'top', before: 0, after: 3 });
  expect(people()).toHaveLength(6);
  expect(notes()[0]?.key).not.toBe(held[0]);
  expect(fresh()).toBe(0);
});

it('a stale person key after query replacement cannot hold a previous note boundary', () => {
  publish('example old');
  open();
  const stale = people()[0]?.key ?? '';
  open({ source: 'search', text: 'lena' });
  engine.handle({
    t: 'window',
    sub: 'search',
    anchor: { key: stale },
    before: 0,
    after: 3,
  });
  expect(notes()).toEqual([]);
  expect(people()).toHaveLength(1);
  expect(people()[0]?.key).not.toBe(stale);
  expect(feedWindow('search', shown())).toEqual({
    first: undefined,
    last: undefined,
    count: 0,
  });
  engine.handle({ t: 'close', sub: 'search' });
  const count = messages.length;
  engine.handle({
    t: 'window',
    sub: 'search',
    anchor: { key: stale },
    before: 0,
    after: 3,
  });
  expect(messages).toHaveLength(count);
});

it('a retained before span keeps the people header while its raw note range still starts at top', () => {
  for (let i = 0; i < 6; i++) publish(`example range ${i}`);
  open();
  const anchor = notes()[2]?.key ?? '';
  engine.handle({
    t: 'window',
    sub: 'search',
    anchor: { key: anchor },
    before: 5,
    after: 3,
  });
  publish('example within retained before span');
  expect(people()).toHaveLength(6);
  expect(fresh()).toBe(0);
  expect(notes().some((r) => r.key === anchor)).toBe(true);
  for (let i = 0; i < 3; i++) publish(`example past before span ${i}`);
  expect(people()).toHaveLength(0);
  expect(fresh()).toBe(1);
  expect(notes().some((r) => r.key === anchor)).toBe(true);
  engine.handle({
    t: 'window',
    sub: 'search',
    anchor: { key: anchor },
    before: 0,
    after: 3,
    retainAbove: true,
  });
  publish('example retained history');
  expect(people()).toHaveLength(6);
  expect(fresh()).toBe(0);
});
