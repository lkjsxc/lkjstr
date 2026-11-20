// "Reset layout" for one workspace, losing nothing. The tabs the default does not have are closed the ordinary way,
// so what they held (a draft, a reading place, a half-typed field) waits in the closed tabs and can be reopened;
// they wait there as one batch, which closing other tabs does not push out. Accounts, keys, settings and relays are
// not layout and are never touched.
//
// Every step writes the new copy before it lets go of the old one: the batch is stored, in a write that survives a
// reload, before any tab's own state goes. A device with no room left keeps the layout as it was and says so.
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
import { type Closed, type ClosedTab, type Closing, closedId, createClosed } from './closed.ts';
import { NEW_TAB } from './launcher.ts';
import * as L from './layout.ts';
import { parseLayout } from './layout-parse.ts';
import type { OwnViews } from './own-views.ts';
import { presetOf } from './presets.ts';

export type ResetParts = {
  root(): L.LayoutNode;
  set(next: L.LayoutNode): void;
  readonly own: Pick<OwnViews, 'unmount' | 'held' | 'drop' | 'revive'>;
  readonly closed: Pick<Closed, 'has' | 'take' | 'pushBatch'>;
  live(): boolean;
};
export type Reset = {
  /** Whether Undo would still put everything back without losing anything. */
  undoable(): boolean;
  /** Takes the reset back; false, changing nothing, once it no longer can (or the device has no room). */
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
/** The closed-tab entry of `view`, where it is in `layout`. */
const closing = (layout: L.LayoutNode, view: string, state: object): Closing => {
  const p = L.paneOfView(layout, view);
  return { kind: kindOf(view), state, pane: p?.id ?? '', index: p?.tabs.indexOf(view) ?? 0 };
};
/** Stores the closed-tab entries of `views` (New tab pages leave none) as one batch; undefined when it could not. */
function putAway(
  closed: Pick<Closed, 'pushBatch'>,
  layout: L.LayoutNode,
  views: readonly string[],
  held: (view: string) => object,
): (ClosedTab | undefined)[] | undefined {
  const kept = views.filter((v) => kindOf(v) !== NEW_TAB && viewOf(v));
  const put = closed.pushBatch(
    kept.map((v) => closing(layout, v, held(v))),
    closedId(),
  );
  return put && views.map((v) => put[kept.indexOf(v)]);
}

/** Puts `next` in place; with a layer, offers Undo there. Undefined: the device had no room, nothing changed. */
export function resetLayout(
  p: ResetParts,
  next: L.LayoutNode,
  layer?: HTMLElement | false,
): Reset | undefined {
  const was = p.root();
  const keep = new Set(L.views(next));
  const views = L.views(was).filter((v) => !keep.has(v));
  for (const v of views) p.own.unmount(v);
  const put = putAway(p.closed, was, views, p.own.held);
  if (!put) return void p.set(was); // drawn again as they were
  for (const v of views) p.own.drop(v);
  const left = views.map((v, i) => [v, put[i]] as const);
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
  const refused = (): false => (layer && toast(layer, t('pane.resetFailed')), false);
  const undo = (): boolean => {
    dismiss();
    if (!undoable()) return false;
    // The put-away tabs get their state back first; their entries go only once everything else is kept.
    if (!left.every(([v, c]) => p.own.revive(v, c?.state))) return refused();
    const typed = [...brought].filter(([v, at]) => made(p.own.held(v)) !== at).map(([v]) => v);
    for (const v of typed) p.own.unmount(v);
    if (!putAway(p.closed, p.root(), typed, p.own.held)) return (p.set(p.root()), refused());
    for (const v of typed) p.own.drop(v);
    for (const [, c] of left) if (c) p.closed.take(c.id);
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
    /** Back to `next`; `undoable`: with an Undo toast (and a word when the device has no room). */
    reset(next: L.LayoutNode, undoable: boolean): boolean {
      const r = resetLayout(p, next, undoable && layer);
      if (!r) {
        if (undoable) toast(layer, t('pane.resetFailed'));
        return false;
      }
      if (!undoable) return true;
      offers.add(r);
      setTimeout(() => offers.delete(r), UNDO_MS);
      return true;
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
 * its closed tabs with what they held, as a reset there would send them. False when the device had no room: then
 * nothing was let go of, and the caller keeps this workspace's layout. */
export function retireSaved(saved: unknown, family: string, index: number): boolean {
  const layout = saved === undefined ? null : parseLayout(saved);
  if (!layout) return true;
  const space = `${family}${index}`;
  const keep = new Set(L.views(presetOf(index, undefined, family)));
  const views = L.views(layout).filter((v) => !keep.has(v));
  const held = (v: string): object => snapshotViewState(`${space}:${v}`);
  if (!putAway(createClosed(space), layout, views, held)) return false;
  for (const v of views) dropViewState(`${space}:${v}`);
  return true;
}
