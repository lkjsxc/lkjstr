import { afterEach, expect, it } from 'vitest';
import type { NoteRow } from '../src/engine/protocol.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import { note } from './public-snapshots-support.ts';
import { vaultEnv } from './vault-ui-fixture.ts';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  localStorage.clear();
});

function fixture() {
  const f = vaultEnv();
  const rows = createRowList(f.el, f.env, false);
  cleanup.push(f.dispose, () => rows.dispose());
  const values = [1, 2, 3, 4].map((n) => ({
    ...note(n.toString(16).padStart(64, '0')),
    author: { ...note().author, picture: undefined },
  }));
  rows.draw(values);
  const nodes = values.map((row) => rows.node(row.key)!);
  const observer = new MutationObserver(() => {});
  observer.observe(f.el, { childList: true });
  cleanup.push(() => observer.disconnect());
  const removed = (): Node[] =>
    observer.takeRecords().flatMap((record) => [...record.removedNodes]);
  const order = (): string[] =>
    [...f.el.children].map((node) => (node as HTMLElement).dataset.key ?? '');
  return { ...f, rows, values, nodes, removed, order };
}

it.each([0, 1])('rebuilds row %i without detaching later unchanged rows', (index) => {
  const f = fixture();
  const later = f.nodes[3]!;
  const button = later.querySelector<HTMLButtonElement>('.name')!;
  button.focus();
  const nested = later.querySelector<HTMLElement>('.content')!;
  nested.scrollLeft = 47;
  expect(document.activeElement).toBe(button);
  const changed: NoteRow = {
    ...f.values[index]!,
    segments: [{ k: 'text', text: 'A changed body requires a new row' }],
  };
  const next = f.values.map((row, i) => (i === index ? changed : row));
  f.rows.draw(next);

  expect(f.removed()).toEqual([f.nodes[index]]);
  expect(f.nodes[index]!.isConnected).toBe(false);
  expect(f.rows.node(changed.key)).not.toBe(f.nodes[index]);
  expect(f.order()).toEqual(next.map((row) => row.key));
  for (let i = 0; i < f.nodes.length; i++)
    if (i !== index) expect(f.rows.node(f.values[i]!.key)).toBe(f.nodes[i]);
  expect(document.activeElement).toBe(button);
  expect(nested.scrollLeft).toBe(47);
});

it.each([0, 1])('removes row %i without moving the retained next row', (index) => {
  const f = fixture();
  const nextNode = f.nodes[index + 1]!;
  const button = nextNode.querySelector<HTMLButtonElement>('.name')!;
  button.focus();
  const next = f.values.filter((_, i) => i !== index);
  f.rows.draw(next);

  expect(f.removed()).toEqual([f.nodes[index]]);
  expect(f.order()).toEqual(next.map((row) => row.key));
  expect(document.activeElement).toBe(button);
  expect(f.rows.node(f.values[index + 1]!.key)).toBe(nextNode);
  expect(f.rows.node(f.values[index]!.key)).toBeUndefined();
});

it('keeps exact order and node identity through insertion, deletion and real reordering', () => {
  const f = fixture();
  const inserted = { ...f.values[0]!, key: '5'.repeat(64), id: '5'.repeat(64) };
  const next = [f.values[3]!, f.values[0]!, inserted, f.values[2]!];
  f.rows.draw(next);

  expect(f.order()).toEqual(next.map((row) => row.key));
  for (const index of [0, 2, 3]) expect(f.rows.node(f.values[index]!.key)).toBe(f.nodes[index]);
  expect(f.rows.node(f.values[1]!.key)).toBeUndefined();
  expect(f.rows.node(inserted.key)).toBe(f.el.children[2]);
  f.rows.draw([]);
  expect(f.el.childNodes).toHaveLength(0);
  f.rows.draw(next);
  expect(f.order()).toEqual(next.map((row) => row.key));
});
