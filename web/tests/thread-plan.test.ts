import { describe, expect, it } from 'vitest';
import type { NoteRow, Row } from '../src/engine/protocol.ts';
import { type Drawn, planThread, type ThreadUi } from '../src/views/thread-plan.ts';

const author = (name: string) => ({ pubkey: name.padEnd(64, '0'), npub: `npub1${name}`, name });
const note = (
  id: string,
  role: 'ancestor' | 'focus' | 'reply',
  parent?: string,
  depth = 0,
): NoteRow =>
  ({
    kind: 'note',
    key: id,
    id,
    author: author(id),
    thread: { role, depth, ...(parent ? { parent } : {}) },
  }) as unknown as NoteRow;
const keys = (d: readonly Drawn[]): string[] =>
  d.map((x) => (x.kind === 'thread-part' ? `${x.part}${'n' in x ? x.n : ''}` : x.key));
const plan = (
  rows: readonly Row[],
  ui: ThreadUi = {},
  asking = false,
  wait: 'loading' | 'missing' = 'loading',
) => planThread(rows, ui, { asking, wait: () => wait });
const lookOf = (d: readonly Drawn[], key: string) =>
  (d.find((x) => x.key === key) as { look?: Record<string, unknown> } | undefined)?.look;

describe('a thread as drawn', () => {
  it('holds the room of a missing note above the top and in a gap, compact above the focus', () => {
    const rows = [note('root', 'ancestor'), note('f', 'focus', 'gone')];
    expect(keys(plan(rows))).toEqual(['root', 'slot', 'f', 'say']);
    const top = [note('a', 'ancestor', 'lost'), note('f', 'focus', 'a')];
    const drawn = plan(top, {}, false, 'missing');
    expect(keys(drawn)).toEqual(['slot', 'a', 'f', 'say']);
    expect(drawn[0]).toMatchObject({ part: 'slot', state: 'missing', first: true });
    expect(lookOf(drawn, 'a')).toEqual({ above: true, below: true, compact: true });
    expect(lookOf(drawn, 'f')).toEqual({ above: true });
    expect(lookOf(plan(top, { open: ['a'] }), 'a')).toMatchObject({ compact: false });
  });
  it('folds more than three notes above to the first and the one answered, until opened', () => {
    const rows = [
      note('a0', 'ancestor'),
      note('a1', 'ancestor', 'a0'),
      note('a2', 'ancestor', 'a1'),
      note('a3', 'ancestor', 'a2'),
      note('f', 'focus', 'a3'),
    ];
    expect(keys(plan(rows))).toEqual(['a0', 'earlier2', 'a3', 'f', 'say']);
    expect(keys(plan(rows, { earlier: true }))).toEqual(['a0', 'a1', 'a2', 'a3', 'f', 'say']);
    expect(keys(plan(rows.slice(1)))).toEqual(['slot', 'a1', 'a2', 'a3', 'f', 'say']);
  });
  it('groups replies under what they answer, one step in, and says whom when it is not plain', () => {
    const rows = [
      note('f', 'focus'),
      note('r1', 'reply', 'f', 1),
      note('r2', 'reply', 'f', 1),
      note('r1a', 'reply', 'r1', 2),
      note('r1b', 'reply', 'r1a', 3),
    ];
    const drawn = plan(rows);
    expect(keys(drawn)).toEqual(['f', 'say', 'r1', 'r1a', 'r1b', 'r2']);
    expect(lookOf(drawn, 'r1')).toEqual({ below: true });
    expect(lookOf(drawn, 'r1a')).toEqual({ step: true });
    expect(lookOf(drawn, 'r1b')).toMatchObject({ step: true, last: true, to: { name: 'r1a' } });
    expect(lookOf(drawn, 'r2')).toEqual({ below: false });
  });
  it('folds a long branch to two replies and the rest, until opened', () => {
    const rows: Row[] = [note('f', 'focus'), note('h', 'reply', 'f', 1)];
    for (let i = 0; i < 5; i++) rows.push(note(`c${i}`, 'reply', 'h', 2));
    expect(keys(plan(rows))).toEqual(['f', 'say', 'h', 'c0', 'c1', 'more3']);
    expect(lookOf(plan(rows), 'c1')).toEqual({ step: true });
    expect(keys(plan(rows, { branches: ['h'] }))).toEqual([
      'f',
      'say',
      'h',
      'c0',
      'c1',
      'c2',
      'c3',
      'c4',
    ]);
  });
  it('keeps replies whose note is not in view at the left, named by the context the engine gave', () => {
    const lost = {
      ...note('o', 'reply', 'gone', 2),
      replyTo: { id: 'gone', author: author('x'), excerpt: '' },
    };
    const drawn = plan([note('f', 'focus'), lost as NoteRow]);
    expect(keys(drawn)).toEqual(['f', 'say', 'o']);
    expect(lookOf(drawn, 'o')).toMatchObject({ to: { name: 'x' } });
    // An older engine without `parent`: the reply context decides, and nothing is held above the top.
    const old = { ...note('a', 'focus'), replyTo: undefined } as NoteRow;
    expect(keys(plan([old]))).toEqual(['a', 'say']);
  });
  it('shows skeletons only while relays are first asked', () => {
    expect(keys(plan([], {}, true))).toEqual(['skeleton']);
    expect(keys(plan([], {}, false))).toEqual([]);
    expect(keys(plan([note('f', 'focus')], {}, true))).toEqual([
      'f',
      'say',
      'skeleton',
      'skeleton',
    ]);
  });
});
