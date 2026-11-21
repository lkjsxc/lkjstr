// A list by keyboard. One row is selected (by j/k, the arrows, or a press on it) and the note keys act on it. The
// selection is a row key, not a focused element: rows are redrawn all the time and focus would be lost or jump.
// It is only drawn once the keyboard is used, and a key that would act on a selection nobody can see shows it
// first instead of acting.
import type { NoteRow } from '../engine/protocol.ts';
import { type KeyId, pressed, typing } from '../shared/keys.ts';
import { popoverOpen } from '../wm/menus.ts';
import type { ListRow } from './feed-draw.ts';
import { plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export type FeedKeys = {
  /** A row is selected and shown: the list must not move under it. */
  held(): string | undefined;
  /** After rows were redrawn. */
  paint(): void;
  clear(): void;
  dispose(): void;
};

/** The action row's buttons the note keys press: one code path for the pointer and the keyboard. */
const BUTTONS: readonly (readonly [KeyId, string])[] = [
  ['reply', '.acts > .a-reply'],
  ['like', '.acts > .a-heart'],
  ['react', '.acts > .a-smile'],
  ['repost', '.acts > .a-repost'],
  ['bookmark', '.acts > .a-bookmark'],
  ['media', '.content > .media a.mbox'],
];
const noteOf = (row: ListRow | undefined): NoteRow | undefined =>
  row?.kind === 'note' ? row : row?.kind === 'notification' ? row.note : undefined;

export function mountFeedKeys(o: {
  readonly el: HTMLElement;
  readonly list: HTMLElement;
  readonly env: ViewEnv;
  /** Whether Escape closes this tab once nothing is selected (a thread, a profile: tabs opened from a note). */
  readonly closes: boolean;
  readonly row: (key: string) => ListRow | undefined;
  readonly node: (key: string) => HTMLElement | undefined;
  /** The selection scrolled the list, or was set or dropped. */
  readonly moved: () => void;
  readonly top: () => void;
}): FeedKeys {
  const { el, list, env } = o;
  let cursor = '';
  let shown = false;
  let drawn: HTMLElement | undefined;
  const paint = (): void => {
    const node = cursor && shown ? o.node(cursor) : undefined;
    if (node === drawn) return;
    drawn?.classList.remove('sel');
    node?.classList.add('sel');
    drawn = node;
  };
  // Day dividers and a thread's skeletons, reply field and placeholders are passed over.
  const rowEls = (): HTMLElement[] =>
    [...list.children].filter(
      (c) => !c.classList.contains('day') && !c.hasAttribute('data-pass'),
    ) as HTMLElement[];
  /** Scrolls only as far as needed, and never smoothly: a held key must keep up. */
  const reveal = (node: HTMLElement): void => {
    const box = el.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const top = box.top;
    if (r.top < top) el.scrollTop += r.top - top;
    else if (r.bottom > box.bottom) el.scrollTop += Math.min(r.bottom - box.bottom, r.top - top);
  };
  const select = (node: HTMLElement | undefined): void => {
    const key = node?.dataset.key;
    if (!node || !key) return;
    cursor = key;
    shown = true;
    // The keyboard leaves a button it was on: Enter then means the selected note, not that button.
    if (list.contains(document.activeElement)) el.focus({ preventScroll: true });
    paint();
    reveal(node);
    o.moved();
  };
  const step = (dir: 1 | -1): void => {
    const all = rowEls();
    const box = el.getBoundingClientRect();
    const top = box.top;
    const at = all.indexOf(o.node(cursor) ?? el);
    const r = all[at]?.getBoundingClientRect();
    // Scrolled away from the selection (or none yet): start from what is on screen.
    if (!r || r.bottom <= top || r.top >= box.bottom) {
      // A thread's first press starts on the note it was opened on while that is in view, not on what it answers.
      const focus = all.find((n) => n.classList.contains('th-focus'))?.getBoundingClientRect();
      if (!cursor && focus && focus.bottom > top + 1 && focus.top < box.bottom)
        return select(all.find((n) => n.classList.contains('th-focus')));
      const first = all.findIndex((n) => n.getBoundingClientRect().bottom > top + 1);
      return select(all[Math.max(0, first)]);
    }
    if (!shown) return select(all[at]);
    select(all[at + dir] ?? all[at]);
  };

  const key = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || typing(e) || popoverOpen()) return;
    if (!env.visible.get() || !el.closest('.pane.cur')) return;
    const on = (id: KeyId): boolean => pressed(e, id);
    if (on('next') || on('prev')) return (e.preventDefault(), step(on('next') ? 1 : -1));
    if (on('top')) return (e.preventDefault(), o.top());
    if (on('back')) {
      if (shown) (shown = false), paint(), o.moved();
      else if (o.closes) env.close();
      else return;
      return e.preventDefault();
    }
    const target = e.target as Element | null;
    const which = [...BUTTONS.map(([id]) => id), 'thread', 'profile'].find((id) =>
      on(id as KeyId),
    ) as KeyId | undefined;
    if (!which) return;
    // A button or link that has the keyboard keeps its own Enter.
    if (which === 'thread' && target?.closest?.('button, a, [role="link"], video, audio')) return;
    e.preventDefault();
    const node = o.node(cursor);
    if (!node || !shown) return step(1); // nothing visibly selected: the first press only shows what would be acted on
    const row = o.row(cursor);
    const note = noteOf(row);
    const from = { beside: true, from: el };
    if (which === 'thread') {
      // A fold or a compact note above a thread's focus opens in place, as a press does.
      if (node.hasAttribute('data-press') || node.classList.contains('th-compact')) node.click();
      else if (note && note.thread?.role !== 'focus')
        env.open('thread', { id: note.id, title: plainName(note.author) }, from);
      else if (row?.kind === 'person')
        env.open('profile', { pubkey: row.author.pubkey, title: plainName(row.author) }, from);
      else if (row?.kind === 'notification' && row.target)
        env.open('thread', { id: row.target.id }, from);
      return;
    }
    if (which === 'profile') {
      const who = note?.author ?? (row?.kind === 'person' ? row.author : undefined);
      if (who) env.open('profile', { pubkey: who.pubkey, title: plainName(who) });
      return;
    }
    if (!note) return;
    // What a menu or the picker gives the keyboard back to: the list, so j and k go on from the same note.
    el.focus({ preventScroll: true });
    node.querySelector<HTMLElement>(BUTTONS.find(([id]) => id === which)?.[1] ?? '')?.click();
  };
  const press = (e: Event): void => {
    const key = (e.target as Element).closest<HTMLElement>('.list > [data-key]')?.dataset.key;
    if (!key || key.startsWith('day:')) return;
    cursor = key;
    if (shown) (shown = false), paint(), o.moved();
  };
  window.addEventListener('keydown', key);
  list.addEventListener('pointerdown', press);
  return {
    held: () => (shown ? cursor : undefined),
    paint,
    clear() {
      shown = false;
      paint();
    },
    dispose() {
      window.removeEventListener('keydown', key);
      list.removeEventListener('pointerdown', press);
    },
  };
}
