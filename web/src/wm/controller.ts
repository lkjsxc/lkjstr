// WM controller for one workspace: layout state, persistence, rendering, view mounts (adapted from ytenrich's:
// no native elements to project, so every tab is an own view).
import { both, t } from '../shared/i18n.ts';
import { keyCaps } from '../shared/keys.ts';
import { kindOf, type OpenOpts, VIEWS, viewOf } from '../views/registry.ts';
import type { Host } from './host.ts';
import { type Choice, NEW_TAB } from './launcher.ts';
import * as L from './layout.ts';
import { parseLayout } from './layout-parse.ts';
import { openMenu } from './menus.ts';
import { type BaseEnv, createOwnViews } from './own-views.ts';
import { FAMILY, presetOf } from './presets.ts';
import { type Rendered, renderLayout } from './render.ts';
import { startResize } from './resize.ts';
import type { Space } from './spaces.ts';
import { startTabDrag } from './tab-drag.ts';
import { mountWmKeys } from './wm-keys.ts';

export type Wm = {
  /** Opens a tab in the tile last touched (a link from outside any tab: the top bar, an address). */
  open(kind: string, state?: object): void;
  dispose(): void;
};

const CLOSED_MAX = 20;
const REF = /^(npub1|nprofile1|note1|nevent1)[a-z0-9]+$/;

export function createWmController(env: BaseEnv, host: Host, at: Space): Wm {
  const preset = (): L.LayoutNode => presetOf(at.index);
  const known = { has: (tab: string): boolean => kindOf(tab) === NEW_TAB || Boolean(viewOf(tab)) };
  /** A stored layout as it can be drawn (`undefined`: nothing stored, so the preset). */
  const load = (value: unknown): L.LayoutNode | null => {
    const saved = value === undefined ? preset() : parseLayout(value);
    return saved && L.retainViews(saved, known);
  };
  let root: L.LayoutNode = load(at.stored) ?? preset();
  let rendered: Rendered | undefined;
  let disposed = false;
  let touched = ''; // the pane last pressed, focused or opened into
  /** For a tab opened beside its reader: the tab that was in front there and what had the keyboard. */
  const back = new Map<string, { view: string; el?: HTMLElement }>(); // bound: one per such open tab

  /** Closed tabs, newest last, each with the state it left and where it was. */
  const closed: { kind: string; state: object; pane: string; index: number }[] = []; // bound: CLOSED_MAX
  const retire = (view: string): void => {
    const p = L.paneOfView(root, view);
    const state = own.retire(view);
    if (kindOf(view) === NEW_TAB) return;
    closed.push({
      kind: kindOf(view),
      state,
      pane: p?.id ?? '',
      index: p?.tabs.indexOf(view) ?? 0,
    });
    if (closed.length > CLOSED_MAX) closed.shift();
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
  /** Puts a tab in front with the keyboard in it. */
  const show = (tab: string): void => {
    const p = L.paneOfView(root, tab);
    if (!p) return;
    if (p.active !== tab) set(L.activate(root, tab));
    mark(p.id);
    own.focus(tab);
  };
  const used = (): Set<string> => new Set(L.views(root));
  const set = (next: L.LayoutNode | null, save = true): void => {
    // The only tile left never disappears: it becomes a New tab page.
    root = next ?? L.pane([own.fresh(NEW_TAB, new Set())]);
    render();
    if (save) at.save(root);
  };
  /** Closing the tab in front shows its right neighbour (the left one at the end), never a jump to the first. */
  const close = (view: string): void => {
    const p = L.paneOfView(root, view);
    const i = p?.tabs.indexOf(view) ?? -1;
    const beside = p && p.active === view ? (p.tabs[i + 1] ?? p.tabs[i - 1]) : undefined;
    const from = back.get(view);
    back.delete(view);
    retire(view);
    // A tab opened from a note gives its place back to what was in front before it, and the keyboard to the reader.
    const prior = from && p?.tabs.includes(from.view) && p.active === view ? from.view : beside;
    const next = L.removeView(root, view);
    set(next && prior ? L.activate(next, prior) : next);
    if (!from?.el?.isConnected) return;
    from.el.focus({ preventScroll: true });
    mark(from.el.closest('.pane')?.getAttribute('data-pane') ?? touched);
  };
  /** A new tab right after `from` in its tile, in front (`split`: in a new tile beside; `background`: behind). */
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
      const q = opts.beside ? (all[i + 1] ?? all[i - 1]) : undefined;
      if (opts.beside) back.set(tab, { view: (q ?? p).active, el: opts.from });
      if (q) touched = q.id;
      const next = q
        ? L.moveView(root, tab, q.id, 'center', q.tabs.length)
        : L.moveView(root, tab, p.id, 'center', at);
      set(opts.background ? L.activate(next, p.active) : next);
    };

  const choice = (kind: string, state?: object, title?: string): Choice => {
    const v = viewOf(kind);
    return {
      kind,
      state,
      title: title ?? (v ? t(v.title) : kind),
      hint: v ? t(v.hint) : '',
      search: v
        ? `${both(v.title)} ${both(v.hint)} ${kind} ${v.aliases ?? ''}`.toLowerCase()
        : kind,
    };
  };
  /** The New tab page `tab` becomes the chosen view. */
  const launcher = (tab: string) => ({
    choices: () => VIEWS.filter((v) => v.launch).map((v) => choice(v.id)),
    typed(text: string): Choice[] {
      if (REF.test(text)) {
        const kind = text.startsWith('np') ? 'profile' : 'thread';
        return [choice(kind, { ref: text }, t('launcher.open', { what: `${text.slice(0, 14)}…` }))];
      }
      const tag = text.replace(/^#/, '');
      const one = !/\s/.test(tag);
      return [
        ...(text.startsWith('#') && one ? [choice('hashtag', { tag }, `#${tag}`)] : []),
        choice('search', { text }, t('launcher.search', { text })),
        ...(!text.startsWith('#') && one ? [choice('hashtag', { tag }, `#${tag}`)] : []),
      ];
    },
    pick: (c: Choice) => set(L.replaceView(root, tab, own.fresh(c.kind, used(), c.state))),
    close: () => close(tab),
  });
  const own = createOwnViews(
    env,
    `${FAMILY}${at.index}`,
    launcher,
    (tab, title) => {
      const span = rendered?.el.querySelector(`.tab[data-view="${tab}"] > span`);
      if (span) span.textContent = title;
      span?.parentElement?.setAttribute('title', title);
    },
    openFrom,
    close,
  );

  const ctx = {
    title: own.title,
    onTabDown(view: string, e: PointerEvent, tab: HTMLElement) {
      startTabDrag(e, tab, ctx.title(view), {
        panes: rendered?.panes ?? new Map(),
        layer: host.layer,
        onClick: () => set(L.activate(root, view)),
        onDrop: (paneId, zone, index) => set(L.moveView(root, view, paneId, zone, index)),
      });
    },
    onClose: close,
    closeClicks: () => env.settings.get().closeClicks,
    onPaneMenu(p: L.PaneNode, button: HTMLElement) {
      const splitTo = (zone: L.Zone) => () => set(L.moveView(root, p.active, p.id, zone));
      openMenu(host.layer, button, [
        ...own.menu(p.active),
        { label: t('pane.splitRight'), run: splitTo('right'), disabled: p.tabs.length < 2 },
        { label: t('pane.splitDown'), run: splitTo('bottom'), disabled: p.tabs.length < 2 },
        {
          label: t('pane.reopen'),
          key: keyCaps('tabReopen')[0],
          run: reopen,
          disabled: !closed.length,
        },
        {
          label: t('pane.close'),
          run: () => (p.tabs.forEach(retire), set(L.closePane(root, p.id))),
        },
        { label: t('pane.reset'), run: () => set(preset()) },
      ]);
    },
    onAdd(p: L.PaneNode) {
      const tab = p.tabs.find((x) => kindOf(x) === NEW_TAB) ?? own.fresh(NEW_TAB, used());
      set(p.tabs.includes(tab) ? L.activate(root, tab) : L.addView(root, p.id, tab, 'center'));
      own.focus(tab);
    },
    onHandleDown(s: L.SplitNode, index: number, e: PointerEvent, cells: HTMLElement[]) {
      startResize(e, s.dir, index, cells, (sizes) => set(L.resize(root, s.id, sizes)));
    },
  };

  /** The tile keys go to (`.cur`): the one last pressed or focused. */
  const mark = (id: string): void => {
    const all = L.panes(root);
    touched = all.some((x) => x.id === id) ? id : (all[0]?.id ?? '');
    for (const [pid, el] of rendered?.panes ?? []) el.classList.toggle('cur', pid === touched);
  };
  function render(): void {
    if (disposed) return;
    own.stash();
    // Rebuilding the tiles detaches every view for a moment: what had the keyboard gets it back.
    const focused = host.root.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)
      : null;
    rendered = renderLayout(root, ctx);
    host.root.replaceChildren(rendered.el);
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

  // Follow layout changes made elsewhere (a reset from Settings, an edit in another browser tab).
  const offStore = at.watch((value) => {
    const next = load(value);
    if (next && !disposed && JSON.stringify(next) !== JSON.stringify(root)) set(next, false);
  });
  const step = <T>(list: readonly T[], at: number, dir: number): T | undefined =>
    list[(at + dir + list.length) % list.length];
  const offKeys = mountWmKeys({
    tab(dir) {
      const p = cur();
      const next = p && step(p.tabs, p.tabs.indexOf(p.active), dir);
      if (next) show(next);
    },
    tile(dir) {
      const all = L.panes(root);
      const next = step(
        all,
        all.findIndex((x) => x.id === cur()?.id),
        dir,
      );
      if (next) show(next.active);
    },
    send() {
      const all = L.panes(root);
      const p = cur();
      const to = step(
        all,
        all.findIndex((x) => x.id === p?.id),
        1,
      );
      if (!p || !to || to.id === p.id) return;
      const tab = p.active;
      set(L.moveView(root, tab, to.id, 'center', to.tabs.length));
      show(tab);
    },
    newTab: () => void (cur() && ctx.onAdd(cur() as L.PaneNode)),
    close: () => void (cur() && close((cur() as L.PaneNode).active)),
    reopen,
    go(kind) {
      const p = cur();
      const there = p?.tabs.find((x) => kindOf(x) === kind);
      if (there) show(there);
      else if (p) openFrom(p.active)(kind), show(cur()?.active ?? '');
    },
    open(kind) {
      openFrom(cur()?.active ?? '')(kind);
      const field = own.el(cur()?.active ?? '')?.querySelector<HTMLElement>('textarea, input');
      field?.focus({ preventScroll: true });
    },
  });
  render();

  return {
    open: (kind, state) => openFrom('')(kind, state),
    dispose() {
      disposed = true;
      offStore();
      offKeys();
      host.root.removeEventListener('pointerdown', onPress, true);
      host.root.removeEventListener('focusin', onPress);
      own.dispose();
      host.root.replaceChildren();
    },
  };
}
