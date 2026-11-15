// Finding a tab. The composer key goes to the composer that is open (the one in the current tile first) unless
// the reader asked for a new one each time. Tab search: one key opens a small field over the current tile. It filters the tabs that are open in this
// workspace and, under them, everything a new tab could be (the same choices as the New tab page). The arrows walk
// the list, Enter goes to the first or the chosen one: an open tab comes to the front, a kind opens beside it.
import { h, replaceChildren } from '../shared/h.ts';
import { both, t } from '../shared/i18n.ts';
import { kindOf, viewOf } from '../views/registry.ts';
import { CHOICES } from './choices.ts';
import { type Choice, matchesWords } from './launcher.ts';
import { openPopover } from './menus.ts';

export type TabFinder = {
  /** The tile the field opens over. */
  anchor(): HTMLElement;
  /** Every open tab of the workspace with its title, in tile order; `here`: in the current tile. */
  tabs(): readonly { tab: string; title: string; here?: boolean; workspace?: number }[];
  show(tab: string, workspace?: number): void;
  /** A new tab in the current tile, in front. */
  open(kind: string, state?: object): void;
  /** The element of the tab in front of the current tile. */
  front(): HTMLElement | undefined;
};

/** The composer with the keyboard in it: the open one (in this tile, else anywhere), or with `fresh` a new one. */
export function goCompose(api: TabFinder, fresh: boolean): void {
  const all = api.tabs().filter((x) => !x.workspace && kindOf(x.tab) === 'compose');
  const there = fresh ? undefined : (all.find((x) => x.here) ?? all[0]);
  if (there) api.show(there.tab);
  else api.open('compose');
  api.front()?.querySelector<HTMLElement>('textarea')?.focus({ preventScroll: true });
}
type Hit = { title: string; hint: string; go(): void; open: boolean; workspace?: number };

/** What the typed text finds: open tabs first, then the kinds a tab can be. Exported for tests. */
export function tabHits(api: Pick<TabFinder, 'tabs' | 'show' | 'open'>, typed: string): Hit[] {
  const text = typed.trim();
  const kind = (c: Choice): Hit => ({
    title: c.title,
    hint: c.hint,
    open: false,
    go: () => api.open(c.kind, c.state),
  });
  const tabs = api
    .tabs()
    .filter(({ tab, title }) => {
      // An open tab is found by what it says on it, and by its kind in either language.
      const v = viewOf(tab);
      const words = `${title} ${v ? both(v.title) : ''} ${tab}`.toLowerCase();
      return matchesWords(words, text);
    })
    .map(
      ({ tab, title, workspace }): Hit => ({
        title,
        hint: '',
        open: true,
        workspace,
        go: () => api.show(tab, workspace),
      }),
    );
  // A view's exact name wins over a word in another view's description ("Relays" used to choose Global).
  const exact = (c: Choice): number => Number(c.title.toLowerCase() === text.toLowerCase());
  const kinds = CHOICES.choices()
    .filter((c) => matchesWords(c.search, text))
    .sort((a, b) => exact(b) - exact(a));
  return [...tabs, ...kinds.map(kind), ...(text ? CHOICES.typed(text).map(kind) : [])];
}

let closeSearch: (() => void) | undefined;
export function openTabSearch(layer: HTMLElement, api: TabFinder): void {
  if (closeSearch) return closeSearch();
  const list = h('div', { class: 'tlist', role: 'listbox' });
  let hits: Hit[] = [];
  let at = 0;
  const pick = (hit: Hit | undefined): void => {
    if (!hit) return;
    close();
    hit.go();
  };
  const draw = (): void => {
    hits = tabHits(api, field.value);
    at = Math.min(at, Math.max(0, hits.length - 1));
    replaceChildren(
      list,
      hits.length
        ? hits.map((hit, i) =>
            h(
              'button',
              {
                class: `titem${i === at ? ' on' : ''}${hit.open ? ' open' : ''}${
                  !hit.open && hits[i - 1]?.open ? ' first' : ''
                }`,
                role: 'option',
                'aria-selected': i === at,
                tabindex: -1,
                onclick: () => pick(hit),
              },
              h('span', { class: 'clip' }, hit.title),
              hit.workspace ? h('span', { class: 'tworkspace' }, String(hit.workspace)) : null,
              hit.hint ? h('span', { class: 'muted clip' }, hit.hint) : null,
            ),
          )
        : h('div', { class: 'empty' }, t('launcher.none')),
    );
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const field = h('input', {
    type: 'search',
    placeholder: t('tabs.search'),
    'aria-label': t('tabs.search'),
    oninput: () => ((at = 0), draw()),
    onkeydown: (e) => {
      const ev = e as KeyboardEvent;
      if (ev.isComposing || ev.keyCode === 229) return; // Enter that confirms Japanese input is not a choice
      const dir = ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
      if (dir && hits.length)
        ev.preventDefault(), (at = (at + dir + hits.length) % hits.length), draw();
      if (ev.key === 'Enter') ev.preventDefault(), pick(hits[at]);
    },
  });
  const el = h('div', { class: 'tsearch' }, field, list);
  const close = openPopover(layer, api.anchor(), el, {
    panel: true,
    closed: () => {
      closeSearch = undefined;
    },
  });
  closeSearch = close;
  draw();
  field.focus({ preventScroll: true });
}
