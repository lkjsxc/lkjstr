// Settings in the manner of an editor's settings page (ytenrich's): a search box over one grouped list. Every word
// typed must occur in an entry's group, title, description (in either language) or key; `@modified` keeps the
// entries changed from their default.
import { h } from '../shared/h.ts';
import { both, t } from '../shared/i18n.ts';
import { SETTINGS_SCHEMA, type Settings } from '../shared/settings.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import type { ViewEnv } from './registry.ts';
import { type Entry, fieldEntry, frame, searchText } from './settings-entry.ts';
import { listEntries } from './settings-lists.ts';
import { relayEntry } from './settings-relays.ts';

const MODIFIED = '@modified';

/** An entry that is a button, not a stored value. */
function actionEntry(name: 'set.resetLayouts', run: () => void): Entry {
  const [group = '', title = ''] = t(name).split(': ');
  const node = frame(
    group,
    title,
    null,
    h('div', { class: 'muted' }, t(`${name}.d`)),
    h('div', { class: 'actions' }, h('button', { onclick: run }, title)),
  );
  return { group, text: searchText(both(name), both(`${name}.d`)), node, sync: () => false };
}

export function mountSettings(el: HTMLElement, env: ViewEnv): () => void {
  const lists = listEntries(env);
  const relays = relayEntry(env);
  const entries = [
    ...SETTINGS_SCHEMA.map((f) => fieldEntry(f, env.settings)),
    ...lists.entries,
    relays.entry,
    actionEntry('set.resetLayouts', env.resetLayouts),
  ];
  const groups = [...new Set(entries.map((e) => e.group))].map((name) => ({
    name,
    head: h('h3', { class: 'sgroup' }, name),
    entries: entries.filter((e) => e.group === name),
  }));
  let changed = new Set<Entry>(); // bound: the entries of this view

  const filter = (): void => {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const e of entries) {
      const hit = words.every((w) => (w === MODIFIED ? changed.has(e) : e.text.includes(w)));
      e.node.hidden = !hit;
      if (hit) shown++;
    }
    for (const g of groups) g.head.hidden = g.entries.every((e) => e.node.hidden);
    count.textContent =
      shown === entries.length
        ? t('settings.count', { n: shown })
        : shown
          ? t('settings.countOf', { n: shown, all: entries.length })
          : t('settings.none');
    modified.textContent = t('settings.modified', { n: changed.size });
    modified.hidden = !changed.size;
  };
  const search = h('input', {
    type: 'search',
    placeholder: t('settings.search'),
    'aria-label': t('settings.search'),
    oninput: filter,
  });
  const count = h('span', { class: 'muted' });
  const modified = h('button', {
    title: t('settings.modifiedHint'),
    onclick: () => {
      search.value = MODIFIED;
      filter();
    },
  });
  const sync = (s: Settings): void => {
    changed = new Set(entries.filter((e) => e.sync(s, document.activeElement)));
    filter();
  };

  el.classList.add('pad');
  el.replaceChildren(
    h('div', { class: 'ssearch' }, search, h('div', { class: 'scount' }, count, modified)),
    ...groups.flatMap((g) => [g.head, ...g.entries.map((e) => e.node)]),
  );
  sync(env.settings.get());
  const off = env.settings.subscribe(sync);
  // Opened for one entry (the relay list, from the Relays tab): it is brought to the top, once.
  const state = loadViewState<{ at?: string }>(env.instance);
  const target = entries.find((e) => e.node.dataset.entry === state.at)?.node;
  if (state.at) saveViewState(env.instance, {});
  if (target)
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      target.querySelector<HTMLElement>('[tabindex], input')?.focus({ preventScroll: true });
    });
  return () => {
    off();
    lists.dispose();
    relays.dispose();
  };
}
