// What sits above a feed's rows, when anything does. Notifications: a row of quiet toggles, one per kind of news.
// Other feeds: the filter bar, which stays away until it is asked for (the tile's "…" menu, or "/") and stays in
// view while it narrows the feed. Showing or hiding it never moves what is being read.
import type { NotificationType } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { keyCaps, pressed } from '../shared/keys.ts';
import { type Filter, filterBar, filterNarrows, filterQuery } from './filter-bar.ts';
import type { ViewEnv } from './registry.ts';

export type BarState = {
  text?: string;
  filter?: Filter;
  /** Notifications: the kinds picked (none picked: everything). */
  only?: string[];
};

const TYPES: readonly (readonly [string, IconName, Key, readonly NotificationType[]])[] = [
  ['reaction', 'heart', 'ntype.reaction', ['reaction']],
  ['reply', 'reply', 'ntype.reply', ['reply', 'mention']],
  ['repost', 'repost', 'ntype.repost', ['repost']],
  ['zap', 'zap', 'ntype.zap', ['zap']],
  ['follow', 'user', 'ntype.follow', ['follow']],
];
/** The notification types a pick stands for (nothing picked: no narrowing). Pure, tested. */
export const typesQuery = (only: readonly string[] = []): NotificationType[] | undefined => {
  const types = TYPES.filter(([id]) => only.includes(id)).flatMap(([, , , list]) => list);
  return types.length ? types : undefined;
};

const BARRED = new Set(['home', 'global', 'hashtag', 'bookmarks', 'search']);
const typing = (e: Event): boolean =>
  Boolean((e.target as Element).closest?.('input, textarea, select, [contenteditable]'));

export function mountFeedBar(o: {
  kind: string;
  el: HTMLElement;
  slot: HTMLElement;
  state: BarState;
  env: ViewEnv;
  save(): void;
  reopen(): void;
}): () => void {
  const { kind, el, slot, state, env } = o;
  /** Replaces the bar; what is being read stays where it is, and the keyboard stays on the control it was on. */
  const put = (bar: HTMLElement | null): void => {
    const controls = (): HTMLElement[] => [...slot.querySelectorAll<HTMLElement>('button, input')];
    const held = controls().indexOf(document.activeElement as HTMLElement);
    const was = slot.offsetHeight;
    slot.replaceChildren(...(bar ? [bar] : []));
    const now = slot.offsetHeight;
    if (now !== was && el.scrollTop > 0) el.scrollTop += now - was;
    if (held >= 0) controls()[held]?.focus({ preventScroll: true });
  };

  if (kind === 'notifications') {
    const draw = (): void => {
      const only = state.only ?? [];
      const toggle = (id: string) => (): void => {
        state.only = only.includes(id) ? only.filter((x) => x !== id) : [...only, id];
        o.save();
        draw();
        o.reopen();
      };
      put(
        h(
          'div',
          { class: 'fbar ntypes', role: 'toolbar', 'aria-label': t('filter.title') },
          TYPES.map(([id, name, label]) =>
            h(
              'button',
              {
                class: only.includes(id) ? 'ntype on' : 'ntype',
                title: t(label),
                'aria-label': t(label),
                'aria-pressed': only.includes(id),
                onclick: toggle(id),
              },
              icon(name),
            ),
          ),
        ),
      );
    };
    draw();
    return () => undefined;
  }
  if (!BARRED.has(kind)) return () => undefined;

  const search = kind === 'search';
  const filter = (): Filter => ({ ...state.filter, ...(search ? { text: state.text } : {}) });
  const input = (): HTMLInputElement | null => slot.querySelector('input');
  const draw = (): void => {
    const f = filter();
    if (!search && !f.shown && !filterNarrows(f)) return put(null);
    put(
      filterBar(
        f,
        search ? 'filter.search' : 'filter.contains',
        (next, typed) => {
          if (search) state.text = next.text;
          state.filter = search ? { ...next, text: undefined } : next;
          o.save();
          const narrowed =
            JSON.stringify(filterQuery(next, 0)) !== JSON.stringify(filterQuery(f, 0));
          if (!typed) draw();
          if (narrowed || typed) o.reopen();
        },
        () => show(false),
      ),
    );
  };
  /** Brings the bar in with the keyboard in its field, or puts it away (a narrowing filter stays in view). */
  const show = (on: boolean): void => {
    state.filter = { ...state.filter, shown: on, open: on ? state.filter?.open : false };
    o.save();
    draw();
    if (on) input()?.focus({ preventScroll: true });
    else if (!input()) el.focus({ preventScroll: true });
  };
  const clear = (): void => {
    state.filter = {};
    o.save();
    draw();
    o.reopen();
    el.focus({ preventScroll: true });
  };
  if (!search)
    env.menu(() => {
      const f = filter();
      if (filterNarrows(f)) return [{ label: t('filter.clear'), run: clear }];
      return f.shown
        ? [{ label: t('filter.hideBar'), run: () => show(false) }]
        : [{ label: t('filter.title'), key: keyCaps('filter')[0], run: () => show(true) }];
    });
  const key = (e: KeyboardEvent): void => {
    if (!pressed(e, 'filter') || typing(e)) return;
    if (!env.visible.get() || !el.closest('.pane.cur')) return;
    e.preventDefault();
    if (input()) input()?.focus({ preventScroll: true });
    else show(true);
  };
  window.addEventListener('keydown', key);
  el.tabIndex = -1;
  draw();
  if (search && !state.text) input()?.focus({ preventScroll: true });
  return () => window.removeEventListener('keydown', key);
}
