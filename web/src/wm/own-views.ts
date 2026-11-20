// The tabs of one controller: lazily mounted per tab id, renamed by their view, dropped when closed. Every lkjstr
// view is an "own view" (there are no native elements to project). A view's element is its own scroller, and its
// scroll position survives the re-renders that detach it.
import { t } from '../shared/i18n.ts';
import { createSignal, type Signal } from '../shared/signal.ts';
import {
  dropViewState,
  loadViewState,
  restoreViewState,
  saveViewSlice,
  snapshotViewState,
} from '../shared/view-state.ts';
import { freshTab, kindOf, type ViewEnv, viewOf } from '../views/registry.ts';
import { type Launcher, type LauncherApi, mountLauncher, NEW_TAB } from './launcher.ts';
import type { MenuItem } from './menus.ts';

type Mounted = {
  el: HTMLElement;
  dispose(): void;
  launcher?: Launcher;
  visible: Signal<boolean>;
  top: number;
  menu?: () => readonly MenuItem[];
};
export type OwnViews = {
  /** Element of a tab (mounted on first use). */
  el(tab: string): HTMLElement | undefined;
  title(tab: string): string;
  /** What the tab adds to its tile's menu. */
  menu(tab: string): readonly MenuItem[];
  /** A tab id for another instance of `kind`, with no state left over from a closed one; `state` is what it starts with. */
  fresh(kind: string, used: ReadonlySet<string>, state?: object): string;
  /** Gives a tab id back the state a retired tab left (an undone reset), before it is drawn again. */
  revive(tab: string, state?: object): void;
  /** Unmounts a tab that is being closed and returns the state it leaves, so it can be opened again as it was. */
  retire(tab: string): object;
  /** Before a render: remembers where every mounted view is scrolled. */
  stash(): void;
  /** After a render: unmounts closed tabs, restores scroll positions, tells views whether they are in front. */
  sync(open: ReadonlySet<string>): void;
  focus(tab: string): void;
  dispose(): void;
};
export type BaseEnv = Omit<
  ViewEnv,
  'instance' | 'setTitle' | 'open' | 'visible' | 'close' | 'menu'
>;

export function createOwnViews(
  env: BaseEnv,
  family: string,
  launcher: (tab: string) => LauncherApi,
  onTitle: (tab: string, title: string) => void,
  open: (from: string) => ViewEnv['open'],
  close: (tab: string) => void,
): OwnViews {
  const mounts = new Map<string, Mounted>(); // bound: one per open tab
  const titles = new Map<string, string>(); // bound: one per open tab
  const instance = (tab: string): string => `${family}:${tab}`;
  const revive = (tab: string, state?: object): void => {
    dropViewState(instance(tab));
    if (state) restoreViewState(instance(tab), state);
    titles.delete(tab);
  };
  return {
    el(tab) {
      const def = viewOf(tab);
      const isNew = kindOf(tab) === NEW_TAB;
      if (!def && !isNew) return undefined;
      let m = mounts.get(tab);
      if (!m) {
        const el = document.createElement('div');
        el.className = 'view';
        el.dataset.kind = kindOf(tab);
        const visible = createSignal(false);
        if (isNew) {
          const l = mountLauncher(el, launcher(tab), instance(tab));
          m = { el, dispose: l.dispose, launcher: l, visible, top: 0 };
        } else {
          const setTitle = (title: string): void => {
            if (titles.get(tab) === title) return;
            titles.set(tab, title);
            onTitle(tab, title);
          };
          const made: Mounted = { el, dispose: () => undefined, visible, top: 0 };
          const dispose = def?.mount(el, {
            ...env,
            engine: { ...env.engine, open: (q, handlers) => env.engine.open(q, handlers, el) },
            instance: instance(tab),
            setTitle,
            visible,
            open: open(tab),
            close: () => close(tab),
            menu: (items) => void (made.menu = items),
          });
          if (dispose) made.dispose = dispose;
          m = made;
        }
        const scroll =
          loadViewState<{ scroll: Record<string, number | { top: number; left: number }> }>(
            instance(tab),
          ).scroll ?? {};
        // Hydrate each scroll axis once; later mutations must respect deliberate position changes.
        // Weak entries also allow replacement child scrollers to restore their saved position.
        const restoredTop = new WeakSet<HTMLElement>();
        const restoredLeft = new WeakSet<HTMLElement>();
        const restore = (): void => {
          for (const [selector, position] of Object.entries(scroll)) {
            if (selector === 'self' && el.matches('.feed:not(.chans)')) continue;
            const node = selector === 'self' ? el : el.querySelector<HTMLElement>(selector);
            if (node) {
              const top = typeof position === 'number' ? position : position.top;
              const left = typeof position === 'number' ? 0 : position.left;
              if (!restoredTop.has(node) && node.scrollHeight > node.clientHeight) {
                restoredTop.add(node);
                node.scrollTop = top;
              }
              if (!restoredLeft.has(node) && node.scrollWidth > node.clientWidth) {
                restoredLeft.add(node);
                node.scrollLeft = left;
              }
            }
          }
        };
        const observer = new ResizeObserver(restore);
        observer.observe(el);
        const content = new MutationObserver(restore);
        content.observe(el, { childList: true, subtree: true });
        const scrolled = (e: Event): void => {
          const target = e.target as HTMLElement;
          const selector =
            target === el
              ? 'self'
              : target.matches('.dtree, .dpage, .stab-wrap, .sbox, textarea')
                ? target.matches('textarea')
                  ? 'textarea'
                  : target.matches('.sbox')
                    ? `[data-entry="${target.closest<HTMLElement>('[data-entry]')?.dataset.entry}"] .sbox`
                    : `.${target.classList[0]}`
                : '';
          if (!selector || !el.isConnected || !visible.get()) return;
          if (selector === 'self' && el.matches('.feed:not(.chans)')) return;
          restoredTop.add(target);
          restoredLeft.add(target);
          scroll[selector] = { top: target.scrollTop, left: target.scrollLeft };
          saveViewSlice(instance(tab), 'scroll', scroll);
        };
        el.addEventListener('scroll', scrolled, true);
        const disposeView = m.dispose;
        m.dispose = () => {
          observer.disconnect();
          content.disconnect();
          el.removeEventListener('scroll', scrolled, true);
          disposeView();
        };
        m.top = typeof scroll.self === 'number' ? scroll.self : (scroll.self?.top ?? 0);
        mounts.set(tab, m);
      }
      return m.el;
    },
    title(tab) {
      if (kindOf(tab) === NEW_TAB) return t('tab.new');
      const def = viewOf(tab);
      if (def && !titles.has(tab)) {
        // A view's saved state may carry the title it last set (a person's name, a hashtag).
        const saved = loadViewState<{ title: string }>(instance(tab)).title;
        titles.set(tab, typeof saved === 'string' && saved ? saved : t(def.title));
      }
      return titles.get(tab) ?? tab;
    },
    menu: (tab) => mounts.get(tab)?.menu?.() ?? [],
    fresh(kind, used, state) {
      const tab = freshTab(kind, used);
      revive(tab, state);
      return tab;
    },
    revive,
    retire(tab) {
      mounts.get(tab)?.dispose(); // a view writes what it still held (its reading position) as it goes
      mounts.delete(tab);
      const state = snapshotViewState(instance(tab));
      dropViewState(instance(tab));
      return state;
    },
    stash() {
      for (const m of mounts.values()) if (m.el.isConnected) m.top = m.el.scrollTop;
    },
    sync(openTabs) {
      for (const [tab, m] of mounts) {
        if (!openTabs.has(tab)) {
          m.dispose();
          mounts.delete(tab);
          dropViewState(instance(tab));
          continue;
        }
        m.launcher?.update();
        if (m.el.isConnected && m.el.scrollTop !== m.top) m.el.scrollTop = m.top;
        m.visible.set(m.el.isConnected);
      }
      for (const tab of titles.keys()) if (!openTabs.has(tab)) titles.delete(tab);
    },
    focus(tab) {
      const m = mounts.get(tab);
      if (m?.launcher) m.launcher.focus();
      else if (m && !m.el.contains(document.activeElement)) m.el.focus({ preventScroll: true });
    },
    dispose() {
      for (const m of mounts.values()) m.dispose();
      mounts.clear();
    },
  };
}
