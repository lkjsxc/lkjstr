// New tab page: `+` opens it as a tab, and picking a card turns that tab into the chosen view. Typing filters the
// cards in English and Japanese alike, whatever the interface language; text that names a hashtag, a person or a
// note, or is simply words to search for, is offered as a first card of its own.
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { pressed } from '../shared/keys.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';

export const NEW_TAB = 'new';
export type Choice = {
  readonly kind: string;
  readonly title: string;
  readonly hint: string;
  /** Lower-case text the filter matches: both languages' labels, the id and aliases. */
  readonly search: string;
  /** State the opened tab starts with (a typed hashtag, search words, a reference). */
  readonly state?: object;
};
export type LauncherApi = {
  choices(): readonly Choice[];
  /** Cards made from the typed text itself (search, hashtag, a pasted npub or note). */
  typed(text: string): readonly Choice[];
  pick(choice: Choice): void;
  close(): void;
};
export type Launcher = { update(): void; focus(): void; dispose(): void };

/** Every word typed occurs in the choice's search text. Exported for tests. */
export const matchesWords = (search: string, typed: string): boolean =>
  typed
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => search.includes(w));

export function mountLauncher(el: HTMLElement, api: LauncherApi, instance = ''): Launcher {
  const state = loadViewState<{ search?: string }>(instance);
  const list = h('div');
  const shown = (): Choice[] => {
    const text = filter.value.trim();
    const views = api.choices().filter((c) => matchesWords(c.search, text));
    return text ? [...views, ...api.typed(text)] : views;
  };
  const card = (c: Choice, first: boolean): HTMLElement =>
    h(
      'button',
      { class: first ? 'ncard first' : 'ncard', onclick: () => api.pick(c) },
      h('b', null, c.title),
      h('span', { class: 'muted' }, c.hint),
    );
  const update = (): void => {
    state.search = filter.value;
    if (instance) saveViewState(instance, state);
    const all = shown();
    replaceChildren(
      list,
      all.length
        ? h(
            'div',
            { class: 'ngrid' },
            all.map((c) => card(c, c === all[0] && filter.value !== '')),
          )
        : h('p', { class: 'muted' }, t('launcher.none')),
    );
  };
  const filter = h('input', {
    type: 'search',
    value: state.search ?? '',
    class: 'wide',
    placeholder: t('launcher.placeholder'),
    'aria-label': t('launcher.placeholder'),
    oninput: update,
    onkeydown: (e) => {
      const ev = e as KeyboardEvent;
      const first = shown()[0]; // Enter that confirms Japanese input is not a choice: `pressed` skips it
      if (pressed(ev, 'launcherPick') && first) api.pick(first);
      if (pressed(ev, 'launcherClose')) api.close();
    },
  });
  el.classList.add('launcher');
  el.replaceChildren(filter, list);
  update();
  return { update, focus: () => filter.focus(), dispose: () => undefined };
}
