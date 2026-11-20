// Finding a tab. The composer key goes to the composer that is open (the one in the current tile first) unless
// the reader asked for a new one each time. Tab search: one key opens a small field over the current tile. It filters the tabs that are open in this
// workspace and, under them, everything a new tab could be (the same choices as the New tab page). The arrows walk
// the list, Enter goes to the first or the chosen one: an open tab comes to the front, a kind opens beside it.

import type { Engine, Subscription } from '../engine/client.ts';
import type { Author } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { both, t } from '../shared/i18n.ts';
import { plainName } from '../views/parts.ts';
import { kindOf, viewOf } from '../views/registry.ts';
import { homeTitle } from '../views/their-home.ts';
import { CHOICES } from './choices.ts';
import { type Choice, matchesWords, titleRank } from './launcher.ts';
import { openPopover } from './menus.ts';

export type TabFinder = {
  readonly engine?: Engine;
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
  // A name wins over a word in another description ("Relays" used to choose Global, "terms" Documentation).
  const here = new Set(
    api
      .tabs()
      .filter((tab) => tab.here && !tab.workspace)
      .map((tab) => kindOf(tab.tab)),
  );
  const kinds = [
    ...CHOICES.choices()
      .filter((c) => text || !here.has(c.kind))
      .filter((c) => matchesWords(c.search, text)),
    ...(text ? CHOICES.typed(text) : []),
  ].sort((a, b) => titleRank(b.title, text) - titleRank(a.title, text));
  return [...tabs, ...kinds.map(kind)];
}

let closeSearch: (() => void) | undefined;
export function openTabSearch(layer: HTMLElement, api: TabFinder): void {
  if (closeSearch) return closeSearch();
  const list = h('div', { class: 'tlist', role: 'listbox' });
  let hits: Hit[] = [];
  let at = 0;
  let people: Subscription | undefined;
  let matches: readonly Author[] = [];
  const pick = (hit: Hit | undefined): void => {
    if (!hit) return;
    close();
    hit.go();
  };
  const draw = (): void => {
    const ordinary = tabHits(api, field.value);
    const homes: Hit[] = matches.map((author) => ({
      title: homeTitle(plainName(author)),
      hint: author.nip05 ?? t('view.their-home'),
      open: false,
      go: () =>
        api.open('their-home', { pubkey: author.pubkey, title: homeTitle(plainName(author)) }),
    }));
    hits = [
      ...ordinary,
      ...homes.filter((hit) => !ordinary.some((old) => old.title === hit.title)),
    ];
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
    oninput: () => {
      at = 0;
      matches = [];
      draw();
      people?.close();
      people = undefined;
      const text = field.value.trim();
      if (!text || (api.engine?.info.get()?.version ?? 0) < 5) return;
      people = api.engine?.open(
        { source: 'people', text, account: api.engine.me() || undefined },
        {
          rows: (rows) => {
            matches = rows.filter((row) => row.kind === 'person').map((row) => row.author);
            draw();
          },
          patch: () => people?.window('top', 0, 6),
        },
      );
      people?.window('top', 0, 6);
      people?.visible(true);
    },
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
      people?.close();
      closeSearch = undefined;
    },
  });
  closeSearch = close;
  draw();
  field.focus({ preventScroll: true });
}
