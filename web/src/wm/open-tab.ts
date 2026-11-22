// Opening a tab from another: in the same tile right after it, split off to the right (Shift), or behind. Nothing
// ever opens in another tile by itself (owner, 2026-11-22), and closing a tab still in front brings back the one it
// was opened from. A quote is written in the Post tab (docs/design.md, Writing): an open Post tab that holds nothing
// takes it; otherwise a new Post tab opens right after the tab that was being read.
import { kindOf, type OpenOpts, viewOf } from '../views/registry.ts';
import * as L from './layout.ts';
import type { OwnViews } from './own-views.ts';

export type OpenParts = {
  root(): L.LayoutNode;
  /** The tile last pressed, focused or opened into. */
  touched(): string;
  touch(paneId: string): void;
  set(next: L.LayoutNode): void;
  show(tab: string): void;
  readonly own: Pick<OwnViews, 'fresh' | 'held' | 'unmount' | 'revive'>;
};
export type Opener = {
  from(from: string): (kind: string, state?: object, opts?: OpenOpts) => void;
  /** The tab `tab` was opened from, and what gets the keyboard back; asked once, as it closes. */
  origin(tab: string): Origin | undefined;
};
type Origin = { readonly view: string; readonly el?: HTMLElement };

/** A Post tab holding nothing that a quote would disturb: no text, media, answer or quote. */
const blank = (s: Record<string, unknown>): boolean =>
  !String(s.text ?? '').trim() &&
  !(Array.isArray(s.media) && s.media.length) &&
  !s.quote &&
  !s.replyTo;

export function createOpener(p: OpenParts): Opener {
  const origins = new Map<string, Origin>(); // bound: one per open tab opened from another
  const open = (from: string, kind: string, state?: object, opts: OpenOpts = {}): void => {
    const root = p.root();
    const panes = L.panes(root);
    const t = L.paneOfView(root, from) ?? panes.find((x) => x.id === p.touched()) ?? panes[0];
    if (!t || !viewOf(kind)) return;
    const tab = p.own.fresh(kind, new Set(L.views(root)), state);
    p.touch(t.id);
    if (opts.split) return p.set(L.addView(root, t.id, tab, 'right'));
    const at = t.tabs.includes(from) ? t.tabs.indexOf(from) + 1 : t.tabs.length;
    const next = L.moveView(root, tab, t.id, 'center', at);
    origins.set(tab, { view: from, el: opts.from });
    p.set(opts.background ? L.activate(next, t.active) : L.front(next, tab));
  };
  const quote = (from: string, state: object, opts: OpenOpts): void => {
    const posts = L.views(p.root()).filter((v) => kindOf(v) === 'compose');
    const free = posts.find((v) => blank(p.own.held(v) as Record<string, unknown>));
    if (!free) return open(from, 'compose', state, opts);
    p.own.unmount(free); // it writes what it held, and is mounted again with the quote
    p.own.revive(free, { ...p.own.held(free), ...state });
    p.set(L.front(p.root(), free));
    p.show(free);
  };
  return {
    from: (from) => (kind, state, opts) =>
      kind === 'compose' && state && 'quote' in state && !opts?.split
        ? quote(from, state, opts ?? {})
        : open(from, kind, state, opts),
    origin(tab) {
      const from = origins.get(tab);
      origins.delete(tab);
      return from;
    },
  };
}
