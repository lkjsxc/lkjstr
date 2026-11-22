// The Docs tab: all of lkjstr's documentation on one page (owner, 2026-11-22). Its contents come first; an entry slides
// to its part inside the tab, and every part ends with a way back to the contents; the address bar never changes.
// What lkjstr is, keys and safety, relays, filters, the shortcuts (the key table itself), the privacy policy, the
// terms and the version facts are its parts. A part is still found by its name (tab search), and opens the tab there.
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
      { id: 'dm', ...text('docs.dm', 'docs.dm.b') },
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
/** What a search for a page matches: its title in both languages and its id, in lower case. */
export const docSearch = (p: Page): string =>
  `${both(p.title)} ${p.id} docs ドキュメント`.toLowerCase();

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
  // `page`: a part to go to once, when the tab is first drawn (a page found by its name); then forgotten.
  const state = loadViewState<{ page?: string; title?: string }>(env.instance);
  const disposers: Disposer[] = [];
  const motion = (): ScrollBehavior =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  /** Scrolls the tab, and the tab alone (the address bar never changes), to bring `target` to its top. */
  const reach = (target: HTMLElement, behavior: ScrollBehavior): void => {
    const top = target.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTo({ top: Math.max(0, el.scrollTop + top - 8), behavior });
  };
  const entry = (id: string): HTMLElement | null => toc.querySelector(`.ditem[data-page="${id}"]`);
  const part = (id: string): HTMLElement | null => el.querySelector(`.dpart[data-page="${id}"]`);
  /** The entry of the part last gone to or come back from is marked, so the reader sees where they were. */
  const mark = (id: string): void => {
    for (const b of toc.querySelectorAll<HTMLElement>('.ditem'))
      b.classList.toggle('on', b.dataset.page === id);
  };
  const go = (id: string, behavior = motion()): void => {
    const target = part(id);
    if (!target) return;
    const head = target.querySelector<HTMLElement>('.dhead') ?? target;
    mark(id);
    reach(head, behavior);
    head.focus({ preventScroll: true });
  };
  /** Back to the contents, which open the page, on the entry of the part the reader comes from. */
  const back = (id: string): void => {
    mark(id);
    el.scrollTo({ top: 0, behavior: motion() });
    entry(id)?.focus({ preventScroll: true });
  };
  const toc = h(
    'nav',
    { class: 'dtoc', 'aria-label': t('docs.contents') },
    h('h2', { class: 'dtitle' }, t('docs.contents')),
    h(
      'div',
      { class: 'dgroups' },
      DOC_TREE.map((g) =>
        h(
          'div',
          { class: 'dgroup' },
          h('h3', null, t(g.title)),
          g.pages.map((p) =>
            h('button', { class: 'ditem', 'data-page': p.id, onclick: () => go(p.id) }, t(p.title)),
          ),
        ),
      ),
    ),
  );
  const body = (p: Page): HTMLElement => {
    const box = h('div', { class: 'dbody' });
    if (p.mount) disposers.push(p.mount(box, env));
    else box.append(...(p.body?.(env) ?? []).flatMap((key) => prose(t(key))));
    return box;
  };
  const parts = DOC_PAGES.map((p) =>
    h(
      'section',
      { class: 'dpart', 'data-page': p.id },
      h('h2', { class: 'dhead', tabIndex: -1 }, t(p.title)),
      body(p),
      h('button', { class: 'dback', onclick: () => back(p.id) }, `↑ ${t('docs.contents')}`),
    ),
  );
  // What the filters part says depends on what the engine serves.
  const filters = parts.find((x) => x.dataset.page === 'filters');
  const redraw = (): void => {
    const p = DOC_PAGES.find((x) => x.id === 'filters');
    filters?.querySelector('.dbody')?.replaceWith(body(p as Page));
  };
  el.classList.add('docs');
  el.tabIndex = -1;
  el.replaceChildren(h('article', { class: 'dpage' }, toc, ...parts));
  // One page, one name: Documentation.
  delete state.title;
  saveViewState(env.instance, state);
  env.setTitle(t('view.docs'));
  // The part asked for is gone to once the tab has its size, before a stored reading place is put back.
  const pending = state.page && state.page !== DOC_PAGES[0]?.id ? state.page : undefined;
  const sized = new ResizeObserver(() => {
    if (!el.clientHeight) return;
    sized.disconnect();
    if (pending) go(pending, 'auto');
    delete state.page;
    saveViewState(env.instance, state);
  });
  sized.observe(el);
  const off = env.engine.info.subscribe(redraw);
  return () => {
    off();
    sized.disconnect();
    for (const dispose of disposers) dispose();
  };
}
