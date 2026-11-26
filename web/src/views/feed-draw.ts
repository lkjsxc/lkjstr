// The rows of a list as elements. A row whose view model did not change keeps its node; a note of which only the
// counts, reactions or the reader's own marks changed keeps its drawn text and gets a new action row; day dividers
// are put between notes of different days. What waits in `held.ts` is drawn as already done.
import type { Row } from '../engine/protocol.ts';
import { dayOf } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { type MomentPart, renderMoment } from './feed-moment.ts';
import { rowTime } from './feed-scrub.ts';
import { withHeld } from './held.ts';
import { disposeLinkCards } from './link-cards.ts';
import { bodySig, patchNote, renderNote } from './note.ts';
import { disposeNoteAudio, reuseNoteAudio } from './note-audio.ts';
import { createNoteFits } from './note-fold.ts';
import type { ViewEnv } from './registry.ts';
import { renderRelayHead } from './relay-head.ts';
import { renderNotification, renderPerson, renderProfile } from './rows.ts';
import type { ThreadPart } from './thread-plan.ts';

/** A row of a list, a part of a thread that is not a note (thread-parts.ts) or a moment tab's line. */
export type ListRow = Row | ThreadPart | MomentPart;

export type RowList = {
  /** Makes the list's children exactly these rows, in order. */
  draw(rows: readonly ListRow[]): void;
  node(key: string): HTMLElement | undefined;
  /** The row as drawn. */
  row(key: string): ListRow | undefined;
  /** Makes the next draw rebuild every row, retaining native playback elements by address. */
  clear(): void;
  dispose(): void;
};

export function createRowList(
  list: HTMLElement,
  env: ViewEnv,
  dates: boolean | (() => boolean),
  part?: (p: ThreadPart) => HTMLElement,
): RowList {
  const folds = createNoteFits(list, env.settings);
  let dated = typeof dates === 'function' ? dates() : dates;
  const nodes = new Map<string, { el: HTMLElement; sig: string; body?: string }>(); // bound: rows of the window plus day dividers
  let shown: readonly ListRow[] = [];
  const render = (row: ListRow, previous?: HTMLElement, lazyFace?: boolean): HTMLElement | null => {
    if (row.kind === 'thread-part') return part?.(row) ?? null;
    if (row.kind === 'moment-part') return renderMoment(row, env);
    if (row.kind === 'note') return renderNote(row, env, dated, { previous, lazyFace });
    if (row.kind === 'profile') return renderProfile(row, env);
    if (row.kind === 'relay') return renderRelayHead(row, env);
    if (row.kind === 'person') return renderPerson(row, env);
    if (row.kind === 'notification') return renderNotification(row, env);
    return null;
  };
  return {
    draw(rows) {
      dated = typeof dates === 'function' ? dates() : dates;
      shown = rows.map((r) => (r.kind === 'note' ? withHeld(r) : r));
      const want: HTMLElement[] = [];
      const seen = new Set<string>();
      let eagerFaces = 6; // Start the head of the window ahead of the first layout and its lazy media.
      let day = dated ? dayOf(Date.now()) : '';
      const put = (key: string, sig: string, make: () => HTMLElement | null): void => {
        let n = nodes.get(key);
        if (!n || n.sig !== sig) {
          if (n) disposeLinkCards(n.el);
          const made = make();
          if (!made) return;
          if (n) {
            reuseNoteAudio(n.el, made);
            disposeNoteAudio(n.el);
          }
          n = { el: made, sig };
          nodes.set(key, n);
          made.dataset.key = key;
        }
        seen.add(key);
        want.push(n.el);
      };
      for (const row of shown) {
        const lazyFace = row.kind === 'note' && !row.hidden && eagerFaces-- <= 0;
        // A moment line counts as an item at its time: a divider for its own day goes above it.
        const at =
          row.kind === 'note' ? rowTime(row) : row.kind === 'moment-part' && !row.end ? row.at : 0;
        if (at && day && dayOf(at) !== day) {
          day = dayOf(at);
          put(`day:${day}`, day, () => h('div', { class: 'day' }, day));
        }
        const sig = `${dated}:${JSON.stringify(row)}`;
        const had = nodes.get(row.key);
        if (
          row.kind === 'notification' &&
          had &&
          had.body === JSON.stringify({ ...row, unread: undefined })
        ) {
          had.el.classList.toggle('unread', row.unread);
          had.sig = sig;
        }
        if (
          row.kind === 'note' &&
          !row.hidden &&
          had &&
          had.sig !== sig &&
          had.body === bodySig(row)
        ) {
          patchNote(had.el, row, env, dated);
          had.sig = sig;
        }
        put(row.key, sig, () => render(row, had?.el, lazyFace));
        const now = nodes.get(row.key);
        if (now && row.kind === 'note') now.body = bodySig(row);
        if (now && row.kind === 'notification')
          now.body = JSON.stringify({ ...row, unread: undefined });
      }
      // Prune stale rows first so the ordering pass never moves retained rows around a removed cursor.
      const wanted = new Set<Node>(want);
      for (const child of [...list.childNodes]) if (!wanted.has(child)) child.remove();
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
      for (const [key, node] of nodes)
        if (!seen.has(key)) {
          disposeLinkCards(node.el);
          disposeNoteAudio(node.el);
          nodes.delete(key);
        }
      const unfitted = want.filter((node) => !node.dataset.fit);
      for (const node of unfitted) node.dataset.fit = '1';
      folds.fit(unfitted);
    },
    node: (key) => nodes.get(key)?.el,
    row: (key) => shown.find((r) => r.key === key),
    clear: () => {
      for (const node of nodes.values()) {
        node.sig = '';
        node.body = undefined;
      }
    },
    dispose: () => {
      folds.dispose();
      for (const node of nodes.values()) {
        disposeLinkCards(node.el);
        disposeNoteAudio(node.el);
      }
      nodes.clear();
    },
  };
}
