// Builds pane/split DOM for a layout. Rebuilt only on structural change; resize mutates flex-grow in place.
// A tile that fills the workspace is drawn alone; a folded tile is its strip alone (upright in a row) and holds no body,
// so its tab is off the page like a tab behind another.
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { keyCaps } from '../shared/keys.ts';
import {
  filled,
  type LayoutNode,
  type PaneNode,
  type SplitNode,
  type ViewId,
  type Zoom,
} from './layout.ts';
import { closeButton, forgetStrips, strip } from './strip.ts';

export type RenderCtx = {
  title(view: ViewId): string;
  onTabDown(view: ViewId, e: PointerEvent, tab: HTMLElement): void;
  onClose(view: ViewId): void;
  /** Clicks on × that close a tab (a guard against closing by accident). */
  closeClicks(): number;
  onPaneMenu(pane: PaneNode, button: HTMLElement): void;
  onAdd(pane: PaneNode): void;
  /** Fills the workspace with the tile, folds it, or (`undefined`) gives it its place again. */
  onZoom(pane: PaneNode, zoom?: Zoom): void;
  canFold(pane: PaneNode): boolean;
  onHandleDown(split: SplitNode, index: number, e: PointerEvent, cells: HTMLElement[]): void;
};
export type Rendered = {
  el: HTMLElement;
  bodies: Map<ViewId, HTMLElement>;
  panes: Map<string, HTMLElement>;
};

export function renderLayout(root: LayoutNode, ctx: RenderCtx): Rendered {
  const out: Rendered = { el: document.createElement('div'), bodies: new Map(), panes: new Map() };
  forgetStrips();
  const max = filled(root);
  out.el = max
    ? renderPane(max, ctx, out)
    : root.type === 'pane'
      ? renderPane(root, ctx, out, false, true)
      : renderSplit(root, ctx, out);
  return out;
}

function renderNode(node: LayoutNode, ctx: RenderCtx, out: Rendered, upright = false): HTMLElement {
  return node.type === 'pane'
    ? renderPane(node, ctx, out, node.zoom === 'min' && upright)
    : renderSplit(node, ctx, out);
}

/** Between "…" and "+" in every state, so the four never move: maximize, then collapse. The one that is on is indigo
 * and undoes itself; the other still acts from there (a collapsed tile maximizes at once). None for a lone tile. */
function zoomButtons(p: PaneNode, ctx: RenderCtx, lone: boolean): HTMLElement[] {
  if (lone) return [];
  const button = (name: IconName, title: string, on: boolean, zoom?: Zoom, disabled = false) =>
    h(
      'button',
      {
        class: on ? 'icon zoom on' : 'icon zoom',
        title,
        'aria-label': title,
        'aria-pressed': on,
        disabled,
        onclick: () => ctx.onZoom(p, zoom),
      },
      icon(name),
    );
  const max = p.zoom === 'max';
  const min = p.zoom === 'min';
  return [
    max
      ? button('unfill', t('pane.unfill', { key: keyCaps('tileRestore')[0] ?? '' }), true)
      : button('fill', t('pane.fill', { key: keyCaps('tileFill')[0] ?? '' }), false, 'max'),
    min
      ? button('unfold', t('pane.unfold'), true)
      : button('fold', t('pane.fold'), false, 'min', !ctx.canFold(p)),
  ];
}

function renderPane(
  p: PaneNode,
  ctx: RenderCtx,
  out: Rendered,
  upright = false,
  lone = false,
): HTMLElement {
  const tab = (view: ViewId): HTMLElement => {
    const close = closeButton(ctx.closeClicks, () => ctx.onClose(view));
    const el: HTMLElement = h(
      'div',
      {
        class: view === p.active ? 'tab active' : 'tab',
        'data-view': view,
        title: ctx.title(view),
      },
      h('span', null, ctx.title(view)),
      close,
    );
    el.addEventListener('pointerdown', (e) => ctx.onTabDown(view, e, el));
    // Middle click closes at once (and never starts the browser's autoscroll).
    el.addEventListener('mousedown', (e) => void (e.button === 1 && e.preventDefault()));
    el.addEventListener('auxclick', (e) => void (e.button === 1 && ctx.onClose(view)));
    return el;
  };
  const folded = p.zoom === 'min';
  const menu: HTMLElement = h(
    'button',
    { class: 'icon', title: t('pane.menu'), onclick: () => ctx.onPaneMenu(p, menu) },
    '…',
  );
  const add: HTMLElement = h(
    'button',
    { class: 'icon', title: t('tab.new'), onclick: () => ctx.onAdd(p) },
    '+',
  );
  const zoom = zoomButtons(p, ctx, lone);
  // The four buttons stand first in every state and never scroll; folded, a press anywhere else on the bar that is not
  // a tab opens the tile too.
  const bar = strip([menu, ...zoom, add], p.tabs.map(tab));
  if (folded) {
    bar.title = t('pane.unfold');
    const row = bar.querySelector('.tabrow');
    bar.addEventListener(
      'click',
      (e) => void ((e.target === bar || e.target === row) && ctx.onZoom(p)),
    );
  }
  const cls = `pane${folded ? ' min' : ''}${upright ? ' upright' : ''}${p.zoom === 'max' ? ' max' : ''}`;
  const el = h('div', { class: cls, 'data-pane': p.id }, bar);
  if (!folded) {
    const body = h('div', { class: 'body own', 'data-view': p.active });
    out.bodies.set(p.active, body);
    el.append(body);
  }
  out.panes.set(p.id, el);
  return el;
}

function renderSplit(s: SplitNode, ctx: RenderCtx, out: Rendered): HTMLElement {
  const el = h('div', { class: `split ${s.dir}` });
  const cells: HTMLElement[] = [];
  // A handle moves the nearest open tiles on either side; with none on one side it is only a line.
  const open = s.children.map((c) => !(c.type === 'pane' && c.zoom === 'min'));
  // The open tiles share all the room (flex-grow summing to less than 1 would leave some empty).
  const share = s.sizes.reduce((sum, z, i) => sum + (open[i] ? z : 0), 0) || 1;
  s.children.forEach((child, i) => {
    if (i > 0) {
      const live = open.slice(0, i).includes(true) && open.slice(i).includes(true);
      const handle = h('div', { class: live ? 'handle' : 'handle still' });
      if (live) handle.addEventListener('pointerdown', (e) => ctx.onHandleDown(s, i - 1, e, cells));
      el.append(handle);
    }
    const cell = h(
      'div',
      {
        class: open[i] ? 'cell' : 'cell min',
        style: `flex:${(s.sizes[i] ?? 1) / (open[i] ? share : 1)} 1 0px`,
      },
      renderNode(child, ctx, out, s.dir === 'row'),
    );
    cells.push(cell);
    el.append(cell);
  });
  return el;
}
