import { afterEach, expect, it } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { NoteRow } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import { fitNote } from '../src/views/note.ts';
import type { ViewEnv } from '../src/views/registry.ts';

const heights = new Map<string, PropertyDescriptor | undefined>();
afterEach(() => {
  for (const [name, descriptor] of heights)
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, name);
  heights.clear();
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});

function setup(count: number) {
  const world = createWorld(1794000000000);
  const source = world.notes[0];
  if (!source) throw new Error('note fixture');
  const base = noteRow(world, source, { me: '' });
  const rows: NoteRow[] = Array.from({ length: count }, (_, n) => ({
    ...base,
    id: `layout-${n}`,
    key: `layout-${n}`,
    hidden: undefined,
    cw: undefined,
    segments: [{ k: 'text', text: `Long note ${n}\n`.repeat(30) }],
    media: [],
    quotes: [],
    previews: undefined,
  }));
  const env = {
    instance: 'layout-test',
    settings: createSettings(),
    engine: { accounts: createSignal({ accounts: [] }) },
  } as unknown as ViewEnv;
  const list = document.createElement('div');
  document.body.append(list);
  const measured: { controls: number; open: boolean }[] = [];
  for (const name of ['scrollHeight', 'clientHeight']) {
    heights.set(name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name));
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        if (name === 'clientHeight') return 100;
        if (this.matches('.content > .text'))
          measured.push({
            controls: list.querySelectorAll('.fold').length,
            open: this.classList.contains('open'),
          });
        return this.textContent === 'short' ? 100 : 900;
      },
    });
  }
  return { rows, list, measured, drawn: createRowList(list, env, false) };
}

it('measures a batch of new notes before a fold control invalidates its next measurement', () => {
  const { rows, list, measured, drawn } = setup(32);
  drawn.draw(rows);
  expect(list.querySelectorAll('.fold')).toHaveLength(32);
  expect(measured).toHaveLength(32);
  expect(measured.every((read) => read.controls === 0)).toBe(true);
  expect([...list.children].map((node) => (node as HTMLElement).dataset.key)).toEqual(
    rows.map((row) => row.key),
  );
});

it('keeps short, unfolded and already fitted notes unchanged through later batches', () => {
  const { rows, list, measured, drawn } = setup(3);
  const first = rows[0];
  if (!first) throw new Error('first note');
  rows[0] = { ...first, segments: [{ k: 'text', text: 'short' }] };
  drawn.draw(rows.slice(0, 2));
  const fold = list.querySelector<HTMLButtonElement>('.fold');
  expect(fold).not.toBeNull();
  fold?.click();
  const opened = list.querySelector<HTMLElement>('.text.open');
  expect(opened).not.toBeNull();
  measured.length = 0;
  drawn.draw(rows);
  expect(measured).toHaveLength(1);
  expect(list.querySelectorAll('.fold')).toHaveLength(1);
  expect(list.querySelector('.text.open')).toBe(opened);
  const newest = list.lastElementChild as HTMLElement;
  fitNote(newest);
  expect(list.querySelectorAll('.fold')).toHaveLength(1);
  expect(measured).toHaveLength(1);
  drawn.draw(rows.map((row) => ({ ...row, counts: { ...row.counts, replies: 3 } })));
  expect(list.querySelector('.text.open')).toBe(opened);
  expect(measured).toHaveLength(1);
});

it('keeps native-scrollbar decisions sequential when folding can change line width', () => {
  const { rows, list, measured, drawn } = setup(3);
  list.className = 'view';
  drawn.draw(rows);
  expect(measured.map((read) => read.controls)).toEqual([0, 1, 2]);
  expect(list.querySelectorAll('.fold')).toHaveLength(3);
});
