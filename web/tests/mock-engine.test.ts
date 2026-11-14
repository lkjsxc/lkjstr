import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { byHandle, SELF } from '../src/engine/mock/people.ts';
import { applyOps } from '../src/engine/ops.ts';
import type { FromEngine, NoteRow, Row } from '../src/engine/protocol.ts';

const NOW = Date.UTC(2026, 10, 14, 3, 0, 0);
let out: FromEngine[] = [];
let engine: MockEngine;
const of = <T extends FromEngine['t']>(t: T): Extract<FromEngine, { t: T }>[] =>
  out.filter((m): m is Extract<FromEngine, { t: T }> => m.t === t);
const last = <T extends FromEngine['t']>(t: T) => of(t).at(-1);

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
});
afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
});

describe('mock engine', () => {
  it('says ready, then who is signed in', () => {
    expect(out[0]).toMatchObject({ t: 'ready', engine: 'mock' });
    expect(last('accounts')?.active).toBe(SELF.author.pubkey);
  });

  it('serves a window around an anchor and says where the list ends', () => {
    engine.handle({ t: 'open', sub: 'a', query: { source: 'home' } });
    engine.handle({ t: 'window', sub: 'a', anchor: 'top', before: 0, after: 30 });
    const top = last('rows');
    expect(top?.rows).toHaveLength(30);
    expect(top?.atTop).toBe(true);
    expect(top?.atBottom).toBe(false);
    const key = top?.rows[20]?.key ?? '';
    engine.handle({ t: 'window', sub: 'a', anchor: { key }, before: 5, after: 10 });
    const mid = last('rows');
    expect(mid?.rows).toHaveLength(15);
    expect(mid?.rows[5]?.key).toBe(key);
    expect(mid?.atTop).toBe(false);
  });

  it('rows are finished view models: segments, media sizes, repost context', () => {
    engine.handle({ t: 'open', sub: 'a', query: { source: 'home' } });
    engine.handle({ t: 'window', sub: 'a', anchor: 'top', before: 0, after: 40 });
    const rows = (last('rows')?.rows ?? []) as NoteRow[];
    const river = rows.find((r) => r.media.some((m) => m.alt?.includes('霧')));
    expect(river?.media[0]).toMatchObject({ w: 1600, h: 1067 });
    expect(river?.repostedBy?.others).toBe(3);
    expect(river?.segments.some((s) => s.k === 'hashtag' && s.tag === '写真')).toBe(true);
    expect(rows.some((r) => r.segments.some((s) => s.k === 'emoji'))).toBe(true);
    expect(rows.some((r) => r.replyTo)).toBe(true);
  });

  it('filters narrow a feed: people, media, text, replies', () => {
    const aoi = byHandle('aoi').author.pubkey;
    engine.handle({
      t: 'open',
      sub: 'a',
      query: { source: 'home', authors: [aoi], media: 'only', replies: false },
    });
    engine.handle({ t: 'window', sub: 'a', anchor: 'top', before: 0, after: 500 });
    const rows = (last('rows')?.rows ?? []) as NoteRow[];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((r) => r.author.pubkey === aoi && r.media.length > 0 && !r.replyTo)).toBe(
      true,
    );
    engine.handle({ t: 'open', sub: 'b', query: { source: 'global', text: 'リレー' } });
    engine.handle({ t: 'window', sub: 'b', anchor: 'top', before: 0, after: 500 });
    expect(last('rows')?.rows.length).toBeGreaterThan(0);
  });

  it('a post arrives at the head of a live window and reports each relay', () => {
    engine.handle({ t: 'open', sub: 'a', query: { source: 'home' } });
    engine.handle({ t: 'window', sub: 'a', anchor: 'top', before: 0, after: 10 });
    let rows: Row[] = [...(last('rows')?.rows ?? [])];
    engine.handle({
      t: 'act',
      req: 'r1',
      action: {
        a: 'publish',
        as: SELF.author.pubkey,
        what: { k: 'note', draft: { text: 'こんにちは' } },
      },
    });
    vi.advanceTimersByTime(3000);
    for (const p of of('patch')) rows = applyOps(rows, p.ops);
    expect((rows[0] as NoteRow).segments[0]).toEqual({ k: 'text', text: 'こんにちは' });
    expect((rows[0] as NoteRow).pending).toBe(false);
    const result = last('result');
    expect(result?.ok).toBe(true);
    expect(result?.delivery?.map((d) => d.state)).toEqual(['ok', 'ok', 'ok', 'failed']);
    expect(of('delivery').length).toBeGreaterThan(2);
  });

  it('a window held by a key only counts what arrives above it', () => {
    engine.handle({ t: 'open', sub: 'a', query: { source: 'home' } });
    engine.handle({ t: 'window', sub: 'a', anchor: 'top', before: 0, after: 10 });
    const key = last('rows')?.rows[3]?.key ?? '';
    engine.handle({ t: 'window', sub: 'a', anchor: { key }, before: 10, after: 10 });
    engine.handle({
      t: 'act',
      req: 'r1',
      action: { a: 'publish', as: SELF.author.pubkey, what: { k: 'note', draft: { text: 'new' } } },
    });
    vi.advanceTimersByTime(200);
    expect(last('fresh')?.count).toBe(1);
    expect(
      of('patch')
        .flatMap((p) => p.ops)
        .some((o) => o.op === 'insert'),
    ).toBe(false);
    engine.handle({ t: 'window', sub: 'a', anchor: 'top', before: 0, after: 10 });
    expect(last('fresh')?.count).toBe(0);
  });

  it('a mute takes effect at once and is listed', () => {
    const kenji = byHandle('kenji').author.pubkey;
    engine.handle({ t: 'open', sub: 'a', query: { source: 'home' } });
    engine.handle({ t: 'window', sub: 'a', anchor: 'top', before: 0, after: 30 });
    let rows: Row[] = [...(last('rows')?.rows ?? [])];
    expect(rows.some((r) => r.kind === 'note' && r.author.pubkey === kenji)).toBe(true);
    engine.handle({ t: 'open', sub: 'm', query: { source: 'mutes' } });
    engine.handle({ t: 'window', sub: 'm', anchor: 'top', before: 0, after: 100 });
    const before = last('rows')?.rows.length ?? 0;
    engine.handle({
      t: 'act',
      req: 'r1',
      action: {
        a: 'mute',
        as: SELF.author.pubkey,
        target: { k: 'person', pubkey: kenji },
        on: true,
      },
    });
    vi.advanceTimersByTime(200);
    const patches = of('patch');
    for (const p of patches.filter((x) => x.sub === 'a')) rows = applyOps(rows, p.ops);
    expect(rows.some((r) => r.kind === 'note' && r.author.pubkey === kenji)).toBe(false);
    const inserted = patches
      .filter((x) => x.sub === 'm')
      .flatMap((p) => p.ops)
      .filter((o) => o.op === 'insert');
    expect(inserted).toHaveLength(1);
    expect(before).toBe(3);
  });

  it('an upload reports progress and returns what a draft needs', async () => {
    const bytes = new Uint8Array(4000).buffer;
    engine.handle({
      t: 'act',
      req: 'u1',
      action: { a: 'upload', as: SELF.author.pubkey, name: 'a.png', mime: 'image/png', bytes },
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(of('progress').length).toBe(5);
    expect(last('result')?.uploaded?.type).toBe('image');
    engine.handle({
      t: 'act',
      req: 'u2',
      action: {
        a: 'upload',
        as: SELF.author.pubkey,
        name: 'fail.png',
        mime: 'image/png',
        bytes: new Uint8Array(10).buffer,
      },
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(last('result')).toMatchObject({ ok: false, error: { code: 'rejected' } });
  });

  it('notifications cover every type and filter by type', () => {
    engine.handle({ t: 'open', sub: 'n', query: { source: 'notifications' } });
    engine.handle({ t: 'window', sub: 'n', anchor: 'top', before: 0, after: 100 });
    const types = new Set(
      (last('rows')?.rows ?? []).map((r) => (r.kind === 'notification' ? r.type : '')),
    );
    expect([...types].sort()).toEqual(['follow', 'mention', 'reaction', 'reply', 'repost', 'zap']);
    engine.handle({ t: 'open', sub: 'z', query: { source: 'notifications', types: ['zap'] } });
    engine.handle({ t: 'window', sub: 'z', anchor: 'top', before: 0, after: 100 });
    expect(last('rows')?.rows.every((r) => r.kind === 'notification' && r.type === 'zap')).toBe(
      true,
    );
  });

  it('a thread puts ancestors first, then the focus, then replies by depth', () => {
    engine.handle({ t: 'open', sub: 'h', query: { source: 'home' } });
    engine.handle({ t: 'window', sub: 'h', anchor: 'top', before: 0, after: 60 });
    const reply = ((last('rows')?.rows ?? []) as NoteRow[]).find(
      (r) => r.replyTo && r.author.name.startsWith('Ada'),
    );
    engine.handle({ t: 'open', sub: 't', query: { source: 'thread', id: reply?.replyTo?.id } });
    engine.handle({ t: 'window', sub: 't', anchor: 'top', before: 0, after: 100 });
    const roles = ((last('rows')?.rows ?? []) as NoteRow[]).map((r) => r.thread?.role);
    expect(roles).toEqual(['ancestor', 'focus', 'reply', 'reply']);
  });
});
