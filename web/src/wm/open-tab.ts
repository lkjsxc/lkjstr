// Opening a tab from another: in the same tile right after it, split off to the right, behind, or beside (in the
// neighbouring tile; closing it gives the keyboard back to where it was opened from). A quote is written in the Post
// tab (docs/design.md, Writing): an open Post tab that holds nothing takes it; otherwise a new Post tab opens next to
// the open one, in its tile, or with none, in the neighbouring tile. The tile that was being read stays as it was.
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
type Back = { view: string; el?: HTMLElement };
export type Opener = {
  from(from: string): (kind: string, state?: object, opts?: OpenOpts) => void;
  /** Where the keyboard goes back to when `tab` closes; asked once, as it closes. */
  back(tab: string): Back | undefined;
};

/** A Post tab holding nothing that a quote would disturb: no text, media, answer or quote. */
const blank = (s: Record<string, unknown>): boolean =>
  !String(s.text ?? '').trim() &&
  !(Array.isArray(s.media) && s.media.length) &&
  !s.quote &&
  !s.replyTo;

export function createOpener(p: OpenParts): Opener {
  const back = new Map<string, Back>(); // bound: one per open tab that was opened beside
  const open = (from: string, kind: string, state?: object, opts: OpenOpts = {}): void => {
    const root = p.root();
    const panes = L.panes(root);
    const t = L.paneOfView(root, from) ?? panes.find((x) => x.id === p.touched()) ?? panes[0];
    if (!t || !viewOf(kind)) return;
    const tab = p.own.fresh(kind, new Set(L.views(root)), state);
    p.touch(t.id);
    if (opts.split) return p.set(L.addView(root, t.id, tab, 'right'));
    const at = t.tabs.includes(from) ? t.tabs.indexOf(from) + 1 : t.tabs.length;
    const i = panes.findIndex((x) => x.id === t.id);
    // Beside: in the neighbouring tile, unless one tile fills the workspace (then it is the only one in view).
    const q = opts.beside && !L.filled(root) ? (panes[i + 1] ?? panes[i - 1]) : undefined;
    if (opts.beside) back.set(tab, { view: (q ?? t).active, el: opts.from });
    if (q) p.touch(q.id);
    const next = q
      ? L.moveView(root, tab, q.id, 'center', q.tabs.length)
      : L.moveView(root, tab, t.id, 'center', at);
    p.set(opts.background ? L.activate(next, t.active) : L.front(next, tab));
  };
  const quote = (from: string, state: object, opts: OpenOpts): void => {
    const posts = L.views(p.root()).filter((v) => kindOf(v) === 'compose');
    const free = posts.find((v) => blank(p.own.held(v) as Record<string, unknown>));
    if (!free) return open(posts[0] ?? from, 'compose', state, { ...opts, beside: !posts[0] });
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
    back(tab) {
      const b = back.get(tab);
      back.delete(tab);
      return b;
    },
  };
}
