// The rows of a list as elements. A row whose view model did not change keeps its node; a note of which only the
// counts, reactions or the reader's own marks changed keeps its drawn text and gets a new action row; day dividers
// are put between notes of different days. What waits in `held.ts` is drawn as already done.
import type { Row } from '../engine/protocol.ts';
import { dayOf } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { withHeld } from './held.ts';
import { bodySig, fitNote, patchNote, renderNote } from './note.ts';
import type { ViewEnv } from './registry.ts';
import { renderNotification, renderPerson, renderProfile } from './rows.ts';

export type RowList = {
  /** Makes the list's children exactly these rows, in order. */
  draw(rows: readonly Row[]): void;
  node(key: string): HTMLElement | undefined;
  /** The row as drawn. */
  row(key: string): Row | undefined;
  /** Forgets every node, so the next draw makes them all again (a setting changed how rows look). */
  clear(): void;
};

export function createRowList(list: HTMLElement, env: ViewEnv, dated: boolean): RowList {
  const nodes = new Map<string, { el: HTMLElement; sig: string; body?: string }>(); // bound: rows of the window plus day dividers
  let shown: readonly Row[] = [];
  const render = (row: Row): HTMLElement | null => {
    if (row.kind === 'note') return renderNote(row, env);
    if (row.kind === 'profile') return renderProfile(row, env);
    if (row.kind === 'person') return renderPerson(row, env);
    if (row.kind === 'notification') return renderNotification(row, env);
    return null;
  };
  return {
    draw(rows) {
      shown = rows.map((r) => (r.kind === 'note' ? withHeld(r) : r));
      const want: HTMLElement[] = [];
      const seen = new Set<string>();
      let day = dated ? dayOf(Date.now()) : '';
      const put = (key: string, sig: string, make: () => HTMLElement | null): void => {
        let n = nodes.get(key);
        if (!n || n.sig !== sig) {
          const made = make();
          if (!made) return;
          n = { el: made, sig };
          nodes.set(key, n);
          made.dataset.key = key;
        }
        seen.add(key);
        want.push(n.el);
      };
      for (const row of shown) {
        const at = row.kind === 'note' ? (row.repostedBy?.at ?? row.at) : 0;
        if (at && day && dayOf(at) !== day) {
          day = dayOf(at);
          put(`day:${day}`, day, () => h('div', { class: 'day' }, day));
        }
        const sig = JSON.stringify(row);
        const had = nodes.get(row.key);
        if (
          row.kind === 'note' &&
          !row.hidden &&
          had &&
          had.sig !== sig &&
          had.body === bodySig(row)
        ) {
          patchNote(had.el, row, env);
          had.sig = sig;
        }
        put(row.key, sig, () => render(row));
        const now = nodes.get(row.key);
        if (now && row.kind === 'note') now.body = bodySig(row);
      }
      let cursor = list.firstChild;
      for (const node of want) {
        if (node === cursor) cursor = cursor.nextSibling;
        else list.insertBefore(node, cursor);
      }
      while (cursor) {
        const next = cursor.nextSibling;
        cursor.remove();
        cursor = next;
      }
      for (const key of [...nodes.keys()]) if (!seen.has(key)) nodes.delete(key);
      for (const node of want) if (!node.dataset.fit) (node.dataset.fit = '1'), fitNote(node);
    },
    node: (key) => nodes.get(key)?.el,
    row: (key) => shown.find((r) => r.key === key),
    clear: () => nodes.clear(),
  };
}
