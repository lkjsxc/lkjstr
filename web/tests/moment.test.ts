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
    drawn: {} as RowList,
    request: vi.fn(),
    sync: vi.fn(),
  });
const keys = (rows: readonly (Row | MomentPart)[]) => rows.map((r) => r.key).join(' ');

describe('a moment tab', () => {
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
