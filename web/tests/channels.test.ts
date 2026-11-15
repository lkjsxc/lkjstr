import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { applyOps } from '../src/engine/ops.ts';
import type {
  Action,
  ChannelRow,
  FromEngine,
  NoteRow,
  Query,
  Row,
} from '../src/engine/protocol.ts';

const NOW = Date.UTC(2026, 10, 14, 3, 0, 0);
let out: FromEngine[] = [];
let engine: MockEngine;
let me = '';
const of = <T extends FromEngine['t']>(t: T): Extract<FromEngine, { t: T }>[] =>
  out.filter((m): m is Extract<FromEngine, { t: T }> => m.t === t);
const last = <T extends FromEngine['t']>(t: T) => of(t).at(-1);
/** The rows of a subscription as the interface would hold them: the last window, then every patch after it. */
const rowsOf = (sub: string): Row[] => {
  let rows: Row[] = [];
  for (const m of out) {
    if (m.t === 'rows' && m.sub === sub) rows = [...m.rows];
    if (m.t === 'patch' && m.sub === sub) rows = applyOps(rows, m.ops);
  }
  return rows;
};
const channels = (sub: string): ChannelRow[] =>
  rowsOf(sub).filter((r): r is ChannelRow => r.kind === 'channel');
const notes = (sub: string): NoteRow[] =>
  rowsOf(sub).filter((r): r is NoteRow => r.kind === 'note');
const open = (sub: string, query: Query): void => {
  engine.handle({ t: 'open', sub, query });
  engine.handle({ t: 'window', sub, anchor: 'top', before: 0, after: 40 });
};
const act = (req: string, action: Action): void => {
  engine.handle({ t: 'act', req, action });
  vi.advanceTimersByTime(3000);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  out = [];
  engine = createMockEngine((m) => out.push(structuredClone(m)));
  engine.handle({
    t: 'configure',
    config: { language: 'ja', heuristics: true, prefetch: true, mock: { live: false } },
  });
  vi.advanceTimersByTime(10);
  me = last('accounts')?.active ?? '';
});
afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
});

describe('channels', () => {
  it('lists the joined channels first, then the others by their latest message', () => {
    open('list', { source: 'channels' });
    const rows = channels('list');
    expect(rows.slice(0, 3).every((c) => c.joined)).toBe(true);
    expect(rows.slice(3).some((c) => c.joined)).toBe(false);
    expect(rows[0]).toMatchObject({ name: 'Nostr 日本語', unread: 4 });
    expect(rows[1]).toMatchObject({ name: 'lkjstr', own: true, unread: 0 });
    const others = rows.slice(3).map((c) => c.last?.at ?? 0);
    expect(others).toEqual([...others].sort((a, b) => b - a));
  });

  it('narrows the list by words, and gives one channel for a reference', () => {
    open('words', { source: 'channels', text: 'relay' });
    expect(channels('words').map((c) => c.name)).toEqual(['Relay operators']);
    open('all', { source: 'channels' });
    const one = channels('all')[4] as ChannelRow;
    open('ref', { source: 'channels', text: one.bech32 });
    expect(channels('ref').map((c) => c.id)).toEqual([one.id]);
    open('hex', { source: 'channels', text: 'f'.repeat(64) });
    expect(channels('hex')).toMatchObject([{ id: 'f'.repeat(64), name: '', joined: false }]);
  });

  it('shows a channel as its header and its messages, which stay out of the timelines', () => {
    open('list', { source: 'channels' });
    const c = channels('list')[0] as ChannelRow;
    open('c', { source: 'channel', id: c.id });
    const rows = rowsOf('c');
    expect(rows[0]).toMatchObject({ kind: 'channel', id: c.id });
    expect(notes('c').every((n) => n.channel?.id === c.id)).toBe(true);
    const times = notes('c').map((n) => n.at);
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(notes('c').some((n) => n.replyTo)).toBe(true);
    open('g', { source: 'global' });
    expect(notes('g').some((n) => n.channel)).toBe(false);
  });

  it('posts into a channel, and a reply to a message stays in its channel', () => {
    open('list', { source: 'channels' });
    const c = channels('list')[1] as ChannelRow;
    open('c', { source: 'channel', id: c.id });
    open('g', { source: 'global' });
    const draft = { text: 'hello channel', channel: c.id };
    act('p1', { a: 'publish', as: me, what: { k: 'note', draft } });
    const sent = notes('c')[0] as NoteRow;
    expect(sent).toMatchObject({ channel: { id: c.id }, mine: { own: true } });
    expect(last('result')).toMatchObject({ req: 'p1', ok: true, id: sent.id });
    expect(channels('list')[1]?.last?.excerpt).toBe('hello channel');
    act('p2', {
      a: 'publish',
      as: me,
      what: { k: 'note', draft: { text: 'yes', replyTo: sent.id } },
    });
    expect(notes('c')[0]).toMatchObject({ channel: { id: c.id }, replyTo: { id: sent.id } });
    expect(notes('g').some((n) => n.channel)).toBe(false);
  });

  it('joins, leaves, marks seen, creates and edits', () => {
    open('list', { source: 'channels' });
    const other = channels('list')[3] as ChannelRow;
    act('j', { a: 'channel.join', as: me, id: other.id, on: true });
    expect(channels('list')[3]).toMatchObject({ id: other.id, joined: true });
    act('l', { a: 'channel.join', as: me, id: other.id, on: false });
    expect(channels('list').find((c) => c.id === other.id)?.joined).toBe(false);
    const first = channels('list')[0] as ChannelRow;
    act('s', { a: 'channel.seen', as: me, id: first.id });
    expect(channels('list')[0]).toMatchObject({ id: first.id, unread: 0 });
    act('n', { a: 'channel.save', as: me, channel: { name: ' 新しい部屋 ', about: '' } });
    const id = last('result')?.id ?? '';
    expect(channels('list').find((c) => c.id === id)).toMatchObject({
      name: '新しい部屋',
      joined: true,
      own: true,
    });
    act('e', { a: 'channel.save', as: me, id, channel: { name: '部屋', about: 'x' } });
    expect(channels('list').find((c) => c.id === id)).toMatchObject({ name: '部屋', about: 'x' });
    act('x', { a: 'channel.save', as: me, id: first.id, channel: { name: 'mine now', about: '' } });
    expect(last('result')).toMatchObject({ ok: false, error: { code: 'rejected' } });
    act('y', { a: 'channel.save', as: me, channel: { name: ' ', about: '' } });
    expect(last('result')).toMatchObject({ ok: false, error: { code: 'rejected' } });
  });
});
