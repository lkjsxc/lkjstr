// The first row of a feed's content: it scrolls away with the rows and never floats over them. Notifications: a
// row of quiet toggles, one per kind of news. Other feeds: the filter row. Whether the row is there is a setting
// (on by default); switched off, it still comes for "/" and stays for as long as it narrows the feed.
import type { NotificationType } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { pressed, typing } from '../shared/keys.ts';
import { rich } from './can.ts';
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

  const wanted = (): boolean => env.settings.get().showFilters;
  let was = wanted();
  /** Draws the row again when the setting that shows it changes. */
  const follow = (draw: () => void): (() => void) =>
    env.settings.subscribe(() => {
      if (was !== wanted()) (was = wanted()), draw();
    });

  if (kind === 'notifications') {
    const draw = (): void => {
      const only = state.only ?? [];
      if (!wanted() && !only.length) return put(null);
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
    return follow(draw);
  }
  if (!BARRED.has(kind)) return () => undefined;

  const search = kind === 'search';
  const filter = (): Filter => ({ ...state.filter, ...(search ? { text: state.text } : {}) });
  const input = (): HTMLInputElement | null => slot.querySelector('input');
  let deferred = false;
  const resume = (): void => {
    if (deferred) {
      deferred = false;
      queueMicrotask(draw);
    }
  };
  slot.addEventListener('focusout', resume);
  const draw = (): void => {
    if (
      slot.contains(document.activeElement) &&
      document.activeElement?.matches('input:not(.padd)')
    ) {
      deferred = true;
      return;
    }
    const f = filter();
    if (!search && !wanted() && !f.shown && !filterNarrows(f)) return put(null);
    put(
      filterBar(
        f,
        search ? 'filter.search' : 'filter.query',
        (next, typed, apply = true) => {
          if (search) state.text = next.text;
          state.filter = search ? { ...next, text: undefined } : next;
          o.save();
          const full = rich(env.engine);
          const narrowed =
            JSON.stringify(filterQuery(next, full)) !== JSON.stringify(filterQuery(f, full));
          Object.assign(f, next);
          if (!apply) return;
          if (!typed) draw();
          if (narrowed || typed) o.reopen();
        },
        () => show(false),
        search ? undefined : clear,
        {
          rich: rich(env.engine),
          news: (kind === 'home' || kind === 'global') && !!env.engine.me(),
        },
      ),
    );
  };
  /** Puts the keyboard in the row's field, bringing the row and the top of the list in, or leaves the field (a
   * row that the setting hides goes away again unless it narrows the feed). */
  const show = (on: boolean): void => {
    state.filter = { ...state.filter, shown: on, open: on ? state.filter?.open : false };
    o.save();
    draw();
    if (on) input()?.focus();
    else el.focus({ preventScroll: true });
  };
  const clear = (): void => {
    state.filter = {};
    o.save();
    draw();
    o.reopen();
    el.focus({ preventScroll: true });
  };
  const key = (e: KeyboardEvent): void => {
    if (!pressed(e, 'filter') || typing(e)) return;
    if (!env.visible.get() || !el.closest('.pane.cur')) return;
    e.preventDefault();
    show(true);
  };
  window.addEventListener('keydown', key);
  el.tabIndex = -1;
  draw();
  if (search && !state.text) input()?.focus({ preventScroll: true });
  const off = follow(draw);
  // The engine says what it understands after the first rows were asked for: a filter is then asked again in full.
  let full = rich(env.engine);
  const offInfo = env.engine.info.subscribe(() => {
    if (full === rich(env.engine)) return;
    full = !full;
    draw();
    if (filterNarrows(filter())) o.reopen();
  });
  const offWho = env.engine.accounts.subscribe(draw);
  return () => (
    slot.removeEventListener('focusout', resume),
    off(),
    offInfo(),
    offWho(),
    window.removeEventListener('keydown', key)
  );
}
