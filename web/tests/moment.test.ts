import { describe, expect, it, vi } from 'vitest';
import type { NoteRow, Row } from '../src/engine/protocol.ts';
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
const moment = () =>
  momentOf('their-home', {
    el: document.createElement('div'),
    state: { at },
    save: vi.fn(),
    keeper: {} as Keeper,
    drawn: { node: () => undefined } as unknown as RowList,
    request: vi.fn(),
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
