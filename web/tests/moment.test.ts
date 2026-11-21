import { describe, expect, it, vi } from 'vitest';
import { projectHidden, revealMockNote } from '../src/engine/mock/hidden.ts';
import type { Sub } from '../src/engine/mock/subscription.ts';
import { seekTime, timeWindow } from '../src/engine/mock/time-window.ts';
import type { FromEngine, NoteRow, Row } from '../src/engine/protocol.ts';
import type { RowList } from '../src/views/feed-draw.ts';
import { type MomentPart, momentOf, renderMoment } from '../src/views/feed-moment.ts';
import type { Keeper } from '../src/views/feed-place.ts';
import type { ViewEnv } from '../src/views/registry.ts';

const at = Date.UTC(2026, 10, 20, 4, 5);
const note = (key: string, time: number, repost?: number) =>
  ({
    kind: 'note',
    key,
    at: time,
    ...(repost && { repostedBy: { at: repost } }),
  }) as unknown as NoteRow;
const moment = (el = document.createElement('div'), request = vi.fn()) =>
  momentOf('their-home', {
    el,
    state: { at },
    save: vi.fn(),
    keeper: {} as Keeper,
    drawn: { node: () => undefined } as unknown as RowList,
    request,
    sync: vi.fn(),
  });
const keys = (rows: readonly (Row | MomentPart)[]) => rows.map((r) => r.key).join(' ');

const answer = (older: string, newer = 'cache-only') =>
  ({
    t: 'timeWindow',
    sub: 's',
    at,
    key: 'b',
    newer,
    older,
    followList: { state: 'latest-verified', at: at + 1, id: 'k' },
  }) as never;

describe('a moment tab', () => {
  it('says each relay span by itself: a newer end beside an older stall, a partial span never an end', () => {
    const rows = [note('a', at + 1), note('b', at - 1)];
    const ends = (older: string, newer: string) => {
      const m = moment();
      m?.answer(answer(older, newer));
      const plan = m?.plan(rows) ?? [];
      return [plan[0], plan.at(-1)].map((p) => (p as MomentPart).end ?? 'none drawn');
    };
    expect(ends('stalled', 'end')).toEqual(['newerNone', 'stalled']);
    expect(ends('end', 'partial')).toEqual(['partial', 'olderNone']); // partial newer: never "nothing newer"
    expect(ends('partial', 'loading')).toEqual(['loading', 'partial']);
  });
  it('labels each end by its own coverage, and the whole window only when both sides are local', () => {
    const newer = Array.from({ length: 60 }, (_, i) => note(`n${i}`, at + 60 - i));
    const draw = (older: string) => {
      const m = moment();
      m?.answer(answer(older));
      return m?.plan([...newer, note('o', at - 1)]) ?? [];
    };
    const mixed = draw('loading');
    expect((mixed[0] as MomentPart).end).toBe('newerDevice'); // newer: this device only, said at its own end
    expect((mixed.find((r) => r.key === 'moment:') as MomentPart).device).toBe(false);
    const local = draw('cache-only');
    expect(local[0]?.key).toBe('n0'); // nothing at the newer end: the line says it for the whole window
    expect((local.find((r) => r.key === 'moment:') as MomentPart).device).toBe(true);
  });
  it('says at its older end what relays did, and that this device ran out only when it did', () => {
    const rows = [note('a', at + 1), note('b', at - 1)];
    const last = (older: string, many = rows) => {
      const m = moment();
      m?.answer(answer(older));
      const plan = m?.plan(many) ?? [];
      return (plan.at(-1) as MomentPart).end ?? 'none drawn';
    };
    expect(last('loading')).toBe('loading');
    expect(last('stalled')).toBe('stalled');
    expect(last('partial')).toBe('partial'); // unresolved, said so
    expect(last('end')).toBe('olderNone'); // 1 older row of 60 asked: relays and this device both ran out
    expect(last('cache-only')).toBe('older');
    const full = Array.from({ length: 60 }, (_, i) => note(`o${i}`, at - 1 - i));
    expect(last('end', full)).toBe('none drawn'); // the window is full: more may follow in the cache
  });
  it.each(['newer', 'older'] as const)('pages past a covered slot on the %s side', (side) => {
    const newer = side === 'newer';
    const el = document.createElement('div');
    Object.defineProperties(el, {
      scrollTop: { value: newer ? 0 : 2000 },
      scrollHeight: { value: 2600 },
      clientHeight: { value: 600 },
    });
    const request = vi.fn();
    const m = moment(el, request);
    m?.answer(answer('cache-only'));
    const notes = Array.from({ length: 59 }, (_, i) =>
      note(`note-${i}`, newer ? at + 59 - i : at - 1 - i),
    );
    const covered: NoteRow = {
      ...note('covered', newer ? at + 60 : at),
      hidden: { reason: 'muted-word', revealable: true },
    };
    const edge = `moment:${side}`;
    expect(m?.plan(notes).map((row) => row.key)).toContain(edge);
    m?.follow(notes);
    expect(request).not.toHaveBeenCalled();

    const full = [covered, ...notes];
    const plan = m?.plan(full) ?? [];
    expect.soft(plan.some((row) => row.key === edge)).toBe(false);
    expect(plan).toContain(covered);
    expect(plan.indexOf(covered) < plan.findIndex((row) => row.key === 'moment:')).toBe(newer);
    m?.follow(full);
    expect(request.mock.calls).toEqual([[{ at }, newer ? 120 : 60, newer ? 60 : 120]]);
  });
  it('is only a their-home tab opened on a time', () => {
    expect(momentOf('home', { state: { at } } as never)).toBeUndefined();
    expect(momentOf('their-home', { state: {} } as never)).toBeUndefined();
  });
  it('draws its line above the first note at or before the time, by the time the list shows', () => {
    const m = moment();
    const rows = [
      note('a', at + 60_000),
      note('b', at - 3_600_000, at + 1),
      note('c', at),
      note('d', at - 1),
    ];
    expect(keys(m?.plan(rows) ?? [])).toBe('a b moment: c d'); // a repost reads as the repost; a tie goes below
    expect(keys(m?.plan([note('a', at + 1), note('b', at + 2)]) ?? [])).toBe('a b moment:');
  });
  it('keeps a crossed-pivot repost on the same side through Show and Hide', () => {
    const author = { pubkey: 'author', npub: 'author', name: 'Author' };
    const reposter = { pubkey: 'reposter', npub: 'reposter', name: 'Reposter' };
    const repost: NoteRow = {
      ...note('repost', at - 6000),
      author,
      repostedBy: { at: at + 15_000, actors: [reposter], others: 0 },
      hidden: { reason: 'muted-person', revealable: true },
      segments: [{ k: 'text', text: 'body' }],
      media: [{ type: 'image', url: 'https://example.invalid/picture.png' }],
    };
    const sub: Sub = {
      id: 's',
      query: { source: 'their-home' },
      entries: [repost, note('newer', at + 5000), note('older', at - 1000)].map((row) => ({
        key: row.key,
        row: () => row,
      })),
      start: 0,
      end: 0,
      live: false,
      windowed: false,
      fresh: 0,
      ops: [],
    };
    const m = moment();
    let rows: readonly Row[] = [];
    const post = (message: FromEngine) => {
      const projected = projectHidden(message, sub.revealed);
      if (projected.t === 'rows') rows = projected.rows;
      if (projected.t === 'timeWindow') m?.answer(projected);
    };
    seekTime(sub, at, 2, 1, post);
    const plan = () =>
      keys(
        (m?.plan(rows) ?? []).filter(
          (row) => row.key !== 'moment:newer' && row.key !== 'moment:older',
        ),
      );
    const order = 'repost newer moment: older';
    const covered = {
      hidden: { reason: 'muted-person' },
      segments: [],
      media: [],
    };
    expect.soft(plan()).toBe(order);
    expect(rows[0]).toMatchObject(covered);
    expect(rows[0]).not.toHaveProperty('repostedBy');
    expect(revealMockNote(sub, repost.key, true)).toBe(true);
    timeWindow(sub, post);
    expect(plan()).toBe(order);
    expect(rows[0]).toMatchObject({ revealed: { reason: 'muted-person' }, media: repost.media });
    expect(revealMockNote(sub, repost.key, false)).toBe(true);
    timeWindow(sub, post);
    expect.soft(plan()).toBe(order);
    expect(rows[0]).toMatchObject(covered);
    expect(rows[0]).not.toHaveProperty('repostedBy');
  });
  it('says what it knows of the follow list, and nothing about ends before the engine answers', () => {
    const env = { settings: { get: () => ({}) } } as unknown as ViewEnv;
    const line = renderMoment(
      { kind: 'moment-part', key: 'moment:', at, follows: null, device: true },
      env,
    );
    expect(line.getAttribute('role')).toBe('separator');
    expect(line.textContent).toContain('Follows not known yet');
    expect(line.textContent).toContain('From this device only');
    expect(keys(moment()?.plan([note('a', at - 1)]) ?? [])).toBe('moment: a');
  });
});
