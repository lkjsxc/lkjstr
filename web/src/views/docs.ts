// The Docs tab: lkjstr explained as a small tree. Groups open and close; a page is shown beside the tree (under
// it in a narrow tile) and names the tab. What lkjstr is, keys and safety, relays, filters, the shortcuts (the
// key table itself), the privacy policy, the terms, and the version facts all live here as pages of one tab kind.
import { h } from '../shared/h.ts';
import { both, type Key, t } from '../shared/i18n.ts';
import type { Disposer } from '../shared/signal.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { rich } from './can.ts';
import { mountAbout, mountShortcuts } from './pages.ts';
import type { ViewEnv } from './registry.ts';

type Page = {
  readonly id: string;
  readonly title: Key;
  /** Prose from the string table, or a page that draws itself. */
  readonly body?: (env: ViewEnv) => readonly Key[];
  readonly mount?: (el: HTMLElement, env: ViewEnv) => Disposer;
};
const text = (title: Key, ...body: Key[]): Omit<Page, 'id'> => ({ title, body: () => body });
export const DOC_TREE: readonly { readonly title: Key; readonly pages: readonly Page[] }[] = [
  {
    title: 'docs.g.about',
    pages: [
      { id: 'what', ...text('docs.what', 'docs.what.b') },
      { id: 'about', title: 'docs.about', mount: mountAbout },
    ],
  },
  {
    title: 'docs.g.use',
    pages: [
      { id: 'keys', ...text('docs.keys', 'docs.keys.b') },
      { id: 'relays', ...text('docs.relays', 'docs.relays.b') },
      {
        id: 'filters',
        title: 'docs.filters',
        // The query syntax and the people list are said only where the engine serves them.
        body: (env) => [
          'docs.filters.b',
          rich(env.engine) ? 'docs.filters.rich' : 'docs.filters.plain',
        ],
      },
      { id: 'shortcuts', title: 'docs.shortcuts', mount: (el) => mountShortcuts(el) },
    ],
  },
  {
    title: 'docs.g.legal',
    pages: [
      { id: 'privacy', ...text('docs.privacy', 'docs.privacy.b', 'docs.previewPrivacy') },
      { id: 'terms', ...text('docs.terms', 'docs.terms.b') },
    ],
  },
];
export const DOC_PAGES: readonly Page[] = DOC_TREE.flatMap((g) => g.pages);
/** What a search for a page matches: its title in both languages and its id. */
export const docSearch = (p: Page): string => `${both(p.title)} ${p.id} docs ドキュメント`;

/** Prose as elements: blank lines part paragraphs, `## ` starts a heading, lines of `- ` are a list. */
export function prose(source: string): HTMLElement[] {
  return source.split('\n\n').flatMap((block) => {
    const lines = block.split('\n');
    const out: HTMLElement[] = [];
    if (lines[0]?.startsWith('## '))
      out.push(h('h3', { class: 'sgroup' }, lines.shift()?.slice(3)));
    if (lines.length && lines.every((l) => l.startsWith('- ')))
      out.push(
        h(
          'ul',
          null,
          lines.map((l) => h('li', null, l.slice(2))),
        ),
      );
    else if (lines.length) out.push(h('p', null, lines.join('\n')));
    return out;
  });
}

export function mountDocs(el: HTMLElement, env: ViewEnv): () => void {
  const state = loadViewState<{ page?: string; shut?: string[]; title?: string }>(env.instance);
  const page = h('article', { class: 'dpage' });
  const tree = h('nav', { class: 'dtree' });
  let dispose: Disposer | undefined;
  const current = (): Page => DOC_PAGES.find((p) => p.id === state.page) ?? (DOC_PAGES[0] as Page);
  const show = (): void => {
    const p = current();
    dispose?.();
    dispose = undefined;
    page.replaceChildren();
    page.className = 'dpage';
    if (p.mount) dispose = p.mount(page, env);
    else page.append(...(p.body?.(env) ?? []).flatMap((key) => prose(t(key))));
    for (const b of tree.querySelectorAll<HTMLElement>('.ditem'))
      b.classList.toggle('on', b.dataset.page === p.id);
    state.title = t(p.title);
    saveViewState(env.instance, state);
    env.setTitle(state.title);
  };
  const go = (id: string): void => {
    if (id === current().id) return;
    state.page = id;
    saveViewState(env.instance, state);
    show();
    el.scrollTop = 0;
  };
  tree.replaceChildren(
    ...DOC_TREE.map((g) => {
      const group = h(
        'details',
        { class: 'dgroup', open: !state.shut?.includes(g.title) },
        h('summary', null, t(g.title)),
        g.pages.map((p) =>
          h('button', { class: 'ditem', 'data-page': p.id, onclick: () => go(p.id) }, t(p.title)),
        ),
      );
      group.addEventListener('toggle', () => {
        const shut = new Set(state.shut ?? []);
        if (group.open) shut.delete(g.title);
        else shut.add(g.title);
        state.shut = [...shut];
        saveViewState(env.instance, state);
      });
      return group;
    }),
  );
  el.classList.add('docs');
  el.tabIndex = -1;
  el.replaceChildren(tree, page);
  show();
  const off = env.engine.info.subscribe(() => void (current().id === 'filters' && show()));
  return () => (off(), dispose?.());
}
