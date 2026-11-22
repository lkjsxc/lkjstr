// Settings in the manner of an editor's settings page (ytenrich's): a search box over one grouped list. Every word
// typed must occur in an entry's group, title, description (in either language) or key; `@modified` keeps the
// entries changed from their default.
import { h } from '../shared/h.ts';
import { both, t } from '../shared/i18n.ts';
import { keepPublicDrafts } from '../shared/public-drafts.ts';
import { SETTINGS_SCHEMA, type Settings } from '../shared/settings.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { canVault } from './account-vault.ts';
import type { ViewEnv } from './registry.ts';
import { inboxRelayEntry } from './settings-dm.ts';
import { type Entry, fieldEntry, frame, searchText } from './settings-entry.ts';
import { listEntries } from './settings-lists.ts';
import { relayEntry } from './settings-relays.ts';

const MODIFIED = '@modified';

/** An entry that is a button, not a stored value. */
function actionEntry(name: 'set.resetLayout' | 'set.resetLayouts', run: () => void): Entry {
  const [group = '', title = ''] = t(name).split(': ');
  const node = frame(
    group,
    title,
    null,
    h('div', { class: 'muted' }, t(`${name}.d`)),
    h('div', { class: 'actions' }, h('button', { onclick: run }, title)),
  );
  node.dataset.entry = name.slice(4);
  return { group, text: searchText(both(name), both(`${name}.d`)), node, sync: () => false };
}

export function mountSettings(el: HTMLElement, env: ViewEnv): () => void {
  const state = loadViewState<{ at?: string; search?: string }>(env.instance);
  const lists = listEntries(env);
  const relays = relayEntry(env);
  const inbox = inboxRelayEntry(env);
  // Resetting this workspace leads its group, so a saved arrangement can take up the default in one press.
  const entries = [
    ...SETTINGS_SCHEMA.filter((f) => f.key !== 'dmWatch').flatMap((f) => [
      ...(f.key === 'uiScale'
        ? [actionEntry('set.resetLayout', () => env.resetLayouts(false))]
        : []),
      fieldEntry(f, env.settings),
    ]),
    relays.entry,
    inbox.entry,
    ...SETTINGS_SCHEMA.filter((f) => f.key === 'dmWatch').map((f) => fieldEntry(f, env.settings)),
    ...lists.entries,
    actionEntry('set.resetLayouts', () => env.resetLayouts(true)),
  ];
  const groups = [...new Set(entries.map((e) => e.group))].map((name) => ({
    name,
    head: h('h3', { class: 'sgroup' }, name),
    entries: entries.filter((e) => e.group === name),
  }));
  let changed = new Set<Entry>(); // bound: the entries of this view
  let seat: ReturnType<typeof setTimeout> | undefined;

  const filter = (): void => {
    state.search = search.value;
    saveViewState(env.instance, state);
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    const available = entries.filter(
      (e) =>
        (e.node.dataset.entry !== 'lockIdle' || canVault(env.engine)) &&
        (e.node.dataset.entry !== 'dmRelays' || (env.engine.info.get()?.version ?? 0) >= 6) &&
        (e.node.dataset.entry !== 'dmWatch' || (env.engine.info.get()?.version ?? 0) >= 8),
    );
    for (const e of entries) {
      const hit =
        available.includes(e) &&
        words.every((w) => (w === MODIFIED ? changed.has(e) : e.text.includes(w)));
      e.node.hidden = !hit;
      if (hit) shown++;
    }
    for (const g of groups) g.head.hidden = g.entries.every((e) => e.node.hidden);
    count.textContent =
      shown === available.length
        ? t('settings.count', { n: shown })
        : shown
          ? t('settings.countOf', { n: shown, all: available.length })
          : t('settings.none');
    modified.textContent = t('settings.modified', { n: changed.size });
    modified.hidden = !changed.size;
  };
  const search = h('input', {
    type: 'search',
    value: state.search ?? '',
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
  const drafts = keepPublicDrafts(el, env.instance);
  sync(env.settings.get());
  const off = env.settings.subscribe(sync);
  const infoOff = env.engine.info.subscribe(filter);
  // Opened for one entry (the relay list, from the Relays tab): it is brought to the top, once. Without one, Settings
  // opens at its top (an action entry has no stored key, and must not match a missing one).
  const target = state.at ? entries.find((e) => e.node.dataset.entry === state.at) : undefined;
  if (state.at) {
    delete state.at;
    saveViewState(env.instance, state);
  }
  if (target) {
    // Its group's heading goes to the top, under the search box; once more when its rows have arrived.
    const head = groups.find((g) => g.name === target.group)?.head ?? target.node;
    const show = (): void => head.scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => {
      show();
      target.node.querySelector<HTMLElement>('[tabindex]')?.focus({ preventScroll: true });
    });
    seat = setTimeout(show, 300);
  }
  return () => {
    clearTimeout(seat);
    drafts();
    off();
    infoOff();
    lists.dispose();
    relays.dispose();
    inbox.dispose();
  };
}
