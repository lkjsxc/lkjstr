// "Reset layout" for one workspace, losing nothing. The tabs the default does not have are closed the ordinary way,
// so what they held (a draft, a reading place, a half-typed field) waits in the closed tabs and can be reopened;
// they wait there as one batch, which closing other tabs does not push out. Accounts, keys, settings and relays are
// not layout and are never touched.
//
// Undo puts the arrangement back and gives those tabs their state again, but only while nothing can be lost by it:
// the workspace still holds exactly the tabs the reset left (moved or resized is fine), and every tab it put away
// still waits in the closed tabs. A tab opened or closed since, here or in another browser tab, ends the offer, and
// its toast goes away. A tab the reset brought in and the old arrangement lacks is closed the ordinary way by Undo
// when something was typed or changed in it since (where it was scrolled to does not count); otherwise it just goes.
import { t } from '../shared/i18n.ts';
import { dropViewState, snapshotViewState } from '../shared/view-state.ts';
import { UNDO_MS } from '../views/held.ts';
import { toast } from '../views/parts.ts';
import { kindOf, viewOf } from '../views/registry.ts';
import { type Closed, type ClosedTab, closedId, createClosed } from './closed.ts';
import { NEW_TAB } from './launcher.ts';
import * as L from './layout.ts';
import { parseLayout } from './layout-parse.ts';
import type { OwnViews } from './own-views.ts';
import { presetOf } from './presets.ts';

export type ResetParts = {
  root(): L.LayoutNode;
  set(next: L.LayoutNode): void;
  /** Closes a tab as the reader would, into `batch`: its state goes to the closed tabs (a New tab page leaves none). */
  retire(view: string, batch: string): ClosedTab | undefined;
  readonly own: Pick<OwnViews, 'revive' | 'held'>;
  readonly closed: Pick<Closed, 'has' | 'take'>;
  live(): boolean;
};
export type Reset = {
  /** Whether Undo would still put everything back without losing anything. */
  undoable(): boolean;
  /** Takes the reset back; false, changing nothing, once it no longer can. */
  undo(): boolean;
  /** Withdraws the Undo toast. */
  dismiss(): void;
};

const sameTabs = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
/** What a tab holds, leaving aside where it is scrolled to. */
const made = (state: object): string => {
  const { scroll: _s, reader: _r, ...rest } = state as Record<string, unknown>;
  return JSON.stringify(rest);
};

/** Puts `next` in place; with a layer, offers Undo there. */
export function resetLayout(p: ResetParts, next: L.LayoutNode, layer?: HTMLElement | false): Reset {
  const was = p.root();
  const keep = new Set(L.views(next));
  const batch = closedId();
  const left = L.views(was)
    .filter((v) => !keep.has(v))
    .map((v) => [v, p.retire(v, batch)] as const);
  p.set(next);
  const had = new Set(L.views(was));
  const brought = new Map(
    L.views(next)
      .filter((v) => !had.has(v))
      .map((v) => [v, made(p.own.held(v))]),
  );
  const undoable = (): boolean =>
    p.live() &&
    sameTabs(L.views(p.root()), L.views(next)) &&
    left.every(([, c]) => !c || p.closed.has(c.id));
  let dismiss = (): void => undefined;
  const undo = (): boolean => {
    dismiss();
    if (!undoable()) return false;
    const back = closedId();
    for (const [v, at] of brought) if (made(p.own.held(v)) !== at) p.retire(v, back);
    for (const [v, c] of left) p.own.revive(v, c && p.closed.take(c.id)?.state);
    p.set(was);
    return true;
  };
  if (layer) dismiss = toast(layer, t('pane.wasReset'), () => void undo());
  return { undoable, undo, dismiss: () => dismiss() };
}

/** The resets of one controller whose Undo is on offer. */
export function createResets(p: ResetParts, layer: HTMLElement) {
  const offers = new Set<Reset>(); // bound: the resets whose Undo toast still shows
  return {
    /** Back to `next`; `undoable`: with an Undo toast. */
    reset(next: L.LayoutNode, undoable: boolean): void {
      const r = resetLayout(p, next, undoable && layer);
      if (!undoable) return;
      offers.add(r);
      setTimeout(() => offers.delete(r), UNDO_MS);
    },
    /** After every change of the layout: withdraws an Undo that could now lose something. */
    check(): void {
      for (const r of offers) if (!r.undoable()) r.dismiss(), offers.delete(r);
    },
    dispose(): void {
      for (const r of offers) r.dismiss();
      offers.clear();
    },
  };
}

/** "Reset every layout" for a workspace that is not on screen: its saved layout's tabs that the default lacks go to
 * its closed tabs with what they held, as a reset there would send them. The caller then forgets the layout. */
export function retireSaved(saved: unknown, family: string, index: number): void {
  const layout = saved === undefined ? null : parseLayout(saved);
  if (!layout) return;
  const space = `${family}${index}`;
  const keep = new Set(L.views(presetOf(index, undefined, family)));
  const closed = createClosed(space);
  const batch = closedId();
  for (const view of L.views(layout)) {
    if (keep.has(view)) continue;
    const p = L.paneOfView(layout, view);
    const state = snapshotViewState(`${space}:${view}`);
    const kind = kindOf(view);
    if (kind !== NEW_TAB && viewOf(view) && p)
      closed.push({ kind, state, pane: p.id, index: p.tabs.indexOf(view) }, batch);
    dropViewState(`${space}:${view}`);
  }
}
