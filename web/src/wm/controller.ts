import { kindOf, type OpenOpts, viewOf } from '../views/registry.ts';
import { CHOICES } from './choices.ts';
import { type ClosedTab, createClosed } from './closed.ts';
import type { Host } from './host.ts';
import { type Choice, NEW_TAB } from './launcher.ts';
import * as L from './layout.ts';
import { parseLayout } from './layout-parse.ts';
import { openMenu } from './menus.ts';
import { type BaseEnv, createOwnViews } from './own-views.ts';
import { paneMenu } from './pane-menu.ts';
import { FAMILY, presetOf } from './presets.ts';
import { type Rendered, renderLayout } from './render.ts';
import { createResets } from './reset.ts';
import { startResize } from './resize.ts';
import type { Space } from './spaces.ts';
import { keepStrips } from './strip.ts';
import { startTabDrag } from './tab-drag.ts';
import { goCompose, openTabSearch, type TabFinder } from './tab-search.ts';
import { mountWmKeys } from './wm-keys.ts';

export type Wm = {
  open(kind: string, state?: object): void;
  go(kind: string): void;
  compose(): void;
  drop(kind: string): void;
  /** Back to the default arrangement (`undoable`: with Undo); false: no room to keep its tabs, nothing changed. */
  reset(undoable: boolean): boolean;
  search(): void;
  show(tab: string): void;
  dispose(): void;
};

export function createWmController(
  env: BaseEnv,
  host: Host,
  at: Space,
  family = FAMILY,
  other?: Pick<TabFinder, 'tabs' | 'show'>,
): Wm {
  const preset = (): L.LayoutNode => presetOf(at.index, undefined, family);
  const known = { has: (tab: string): boolean => kindOf(tab) === NEW_TAB || Boolean(viewOf(tab)) };
  const load = (value: unknown): L.LayoutNode | null => {
    const saved = value === undefined ? preset() : parseLayout(value);
    return saved && L.retainViews(saved, known);
  };
  let root: L.LayoutNode = load(at.stored) ?? preset();
  let rendered: Rendered | undefined;
  let disposed = false;
  let touched = ''; // the pane last pressed, focused or opened into
  const back = new Map<string, { view: string; el?: HTMLElement }>(); // bound: one per such open tab

  const closed = createClosed(`${family}${at.index}`);
  const retire = (view: string): ClosedTab | undefined => {
    const p = L.paneOfView(root, view);
    const state = own.retire(view);
    if (kindOf(view) === NEW_TAB) return;
    const c = { kind: kindOf(view), state, pane: p?.id ?? '', index: p?.tabs.indexOf(view) ?? 0 };
    return closed.push(c);
  };
  const reopen = (): void => {
    const c = closed.pop();
    const p = L.panes(root).find((x) => x.id === c?.pane) ?? cur();
    if (!c || !p) return;
    const tab = own.fresh(c.kind, used(), c.state);
    set(L.moveView(root, tab, p.id, 'center', Math.min(c.index, p.tabs.length)));
    show(tab);
  };
  const cur = (): L.PaneNode | undefined =>
    L.panes(root).find((x) => x.id === touched) ?? L.panes(root)[0];
  const show = (tab: string): void => {
    const p = L.paneOfView(root, tab);
    if (!p) return;
    const next = L.front(root, tab);
    if (next !== root) set(next);
    mark(p.id);
    own.focus(tab);
  };
  const used = (): Set<string> => new Set(L.views(root));
  const set = (next: L.LayoutNode | null, save = true): void => {
    root = next ?? L.pane([own.fresh(NEW_TAB, new Set())]);
    render();
    if (save) at.save(root);
    resets.check();
  };
  const close = (view: string): void => {
    const p = L.paneOfView(root, view);
    const i = p?.tabs.indexOf(view) ?? -1;
    const beside = p && p.active === view ? (p.tabs[i + 1] ?? p.tabs[i - 1]) : undefined;
    const from = back.get(view);
    back.delete(view);
    retire(view);
    const prior = from && p?.tabs.includes(from.view) && p.active === view ? from.view : beside;
    const next = L.removeView(root, view);
    set(next && prior ? L.activate(next, prior) : next);
    if (!from?.el?.isConnected) return;
    from.el.focus({ preventScroll: true });
    mark(from.el.closest('.pane')?.getAttribute('data-pane') ?? touched);
  };
  const openFrom =
    (from: string) =>
    (kind: string, state?: object, opts: OpenOpts = {}): void => {
      const p =
        L.paneOfView(root, from) ?? L.panes(root).find((x) => x.id === touched) ?? L.panes(root)[0];
      if (!p || !viewOf(kind)) return;
      const tab = own.fresh(kind, used(), state);
      touched = p.id;
      if (opts.split) return set(L.addView(root, p.id, tab, 'right'));
      const at = p.tabs.includes(from) ? p.tabs.indexOf(from) + 1 : p.tabs.length;
      const all = L.panes(root);
      const i = all.findIndex((x) => x.id === p.id);
      // Beside: in the neighbouring tile, unless one tile fills the workspace (then it is the only one in view).
      const q = opts.beside && !L.filled(root) ? (all[i + 1] ?? all[i - 1]) : undefined;
      if (opts.beside) back.set(tab, { view: (q ?? p).active, el: opts.from });
      if (q) touched = q.id;
      const next = q
        ? L.moveView(root, tab, q.id, 'center', q.tabs.length)
        : L.moveView(root, tab, p.id, 'center', at);
      set(opts.background ? L.activate(next, p.active) : L.front(next, tab));
    };

  const launcher = (tab: string) => ({
    ...CHOICES,
    pick: (c: Choice) => set(L.replaceView(root, tab, own.fresh(c.kind, used(), c.state))),
    close: () => close(tab),
  });
  const own = createOwnViews(
    env,
    `${family}${at.index}`,
    launcher,
    (tab, title) => {
      const span = rendered?.el.querySelector(`.tab[data-view="${tab}"] > span`);
      if (span) span.textContent = title;
      span?.parentElement?.setAttribute('title', title);
    },
    openFrom,
    close,
  );

  const resets = createResets(
    { root: () => root, set, own, closed, live: () => !disposed },
    host.layer,
  );
  const ctx = {
    title: own.title,
    onTabDown(view: string, e: PointerEvent, tab: HTMLElement) {
      startTabDrag(e, tab, ctx.title(view), {
        panes: rendered?.panes ?? new Map(),
        layer: host.layer,
        onClick: () => set(L.front(root, view)),
        onDrop: (paneId, zone, index) => set(L.moveView(root, view, paneId, zone, index)),
      });
    },
    onClose: close,
    closeClicks: () => env.settings.get().closeClicks,
    onPaneMenu(p: L.PaneNode, button: HTMLElement) {
      const menu = paneMenu(p, {
        own: own.menu(p.active),
        split: (zone) => set(L.moveView(root, p.active, p.id, zone)),
        reopen: closed.size() ? reopen : undefined,
        close: () => (p.tabs.forEach(retire), set(L.closePane(root, p.id))),
      });
      openMenu(host.layer, button, menu);
    },
    onZoom(p: L.PaneNode, zoom?: L.Zoom) {
      set(L.zoomPane(root, p.id, zoom));
      mark(p.id);
      if (zoom !== 'min') own.focus(p.active);
    },
    canFold: (p: L.PaneNode) => L.canFold(root, p.id),
    onAdd(p: L.PaneNode) {
      const tab = p.tabs.find((x) => kindOf(x) === NEW_TAB) ?? own.fresh(NEW_TAB, used());
      set(p.tabs.includes(tab) ? L.activate(root, tab) : L.addView(root, p.id, tab, 'center'));
      own.focus(tab);
    },
    onHandleDown(s: L.SplitNode, index: number, e: PointerEvent, cells: HTMLElement[]) {
      startResize(e, s.dir, index, cells, (sizes) => set(L.resize(root, s.id, sizes)));
    },
  };

  const mark = (id: string): void => {
    const all = L.panes(root);
    touched = all.some((x) => x.id === id) ? id : (all[0]?.id ?? '');
    for (const [pid, el] of rendered?.panes ?? []) el.classList.toggle('cur', pid === touched);
  };
  function render(): void {
    if (disposed) return;
    own.stash();
    const focused = host.root.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)
      : null;
    const strips = keepStrips(rendered?.panes ?? new Map());
    rendered = renderLayout(root, ctx);
    host.root.replaceChildren(rendered.el);
    strips(rendered.panes);
    for (const [view, body] of rendered.bodies) {
      const el = own.el(view);
      if (el) body.append(el);
    }
    own.sync(used());
    mark(touched);
    if (focused?.isConnected && !host.root.contains(document.activeElement))
      focused.focus({ preventScroll: true });
  }
  const onPress = (e: Event): void =>
    mark((e.target as Element).closest?.('.pane')?.getAttribute('data-pane') ?? touched);
  host.root.addEventListener('pointerdown', onPress, true);
  host.root.addEventListener('focusin', onPress);

  const offStore = at.watch((value) => {
    const next = load(value);
    if (next && !disposed && JSON.stringify(next) !== JSON.stringify(root)) set(next, false);
  });
  const finder: TabFinder = {
    engine: env.engine,
    anchor: () => rendered?.panes.get(cur()?.id ?? '')?.querySelector('.strip') ?? host.root,
    tabs: () => [
      ...L.views(root)
        .filter((v) => kindOf(v) !== NEW_TAB)
        .map((tab) => ({ tab, title: own.title(tab), here: cur()?.tabs.includes(tab) === true })),
      ...(other?.tabs() ?? []),
    ],
    show: (tab, workspace) => (workspace ? other?.show(tab, workspace) : show(tab)),
    open: (kind, state) => openFrom(cur()?.active ?? '')(kind, state),
    front: () => own.el(cur()?.active ?? ''),
  };
  const compose = (): void => goCompose(finder, env.settings.get().composeNew);
  const beside = (dir: number): L.PaneNode | undefined => L.beside(root, cur()?.id, dir);
  const offKeys = mountWmKeys({
    tab(dir) {
      const p = cur();
      const next = p && L.step(p.tabs, p.tabs.indexOf(p.active), dir);
      if (next) show(next);
    },
    tile(dir) {
      const next = beside(dir);
      if (next) show(next.active);
    },
    send() {
      const p = cur();
      const to = beside(1);
      if (!p || !to || to.id === p.id) return;
      const tab = p.active;
      set(L.moveView(root, tab, to.id, 'center', to.tabs.length));
      show(tab);
    },
    newTab: () => void (cur() && ctx.onAdd(cur() as L.PaneNode)),
    fill() {
      const p = cur();
      if (p) ctx.onZoom(p, p.zoom === 'max' ? undefined : 'max');
    },
    restore() {
      const p = L.filled(root);
      return p ? (ctx.onZoom(p), true) : false;
    },
    close: () => void (cur() && close((cur() as L.PaneNode).active)),
    reopen,
    go(kind, state) {
      const p = cur();
      const there = p?.tabs.find((x) => kindOf(x) === kind);
      if (there) show(there);
      else if (p) openFrom(p.active)(kind, state), show(cur()?.active ?? '');
    },
    compose,
    search: () => openTabSearch(host.layer, finder),
  });
  render();
  at.save(root);

  return {
    open: (kind, state) => openFrom('')(kind, state),
    drop: (kind) =>
      L.views(root)
        .filter((v) => kindOf(v) === kind)
        .forEach(close),
    go(kind) {
      const there = L.views(root).find((v) => kindOf(v) === kind);
      if (there) show(there);
      else openFrom('')(kind);
    },
    compose,
    reset: (undoable) => resets.reset(preset(), undoable),
    search: () => openTabSearch(host.layer, finder),
    show,
    dispose() {
      disposed = true;
      resets.dispose();
      offStore();
      offKeys();
      host.root.removeEventListener('pointerdown', onPress, true);
      host.root.removeEventListener('focusin', onPress);
      own.dispose();
      host.root.replaceChildren();
    },
  };
}
