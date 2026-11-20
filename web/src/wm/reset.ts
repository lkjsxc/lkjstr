// "Reset layout" for one workspace, losing nothing. The tabs the default does not have are closed the ordinary way,
// so what they held (a draft, a reading place, a half-typed field) waits in the closed tabs and can be reopened.
// Undo, while its toast lasts, puts the arrangement back and gives those tabs their state again. Accounts, keys,
// settings and relays are not layout and are never touched.
import { t } from '../shared/i18n.ts';
import { toast } from '../views/parts.ts';
import type { Closed, ClosedTab } from './closed.ts';
import * as L from './layout.ts';
import type { OwnViews } from './own-views.ts';

export type ResetParts = {
  root(): L.LayoutNode;
  set(next: L.LayoutNode): void;
  /** Closes a tab as the reader would: its state goes to the closed tabs (a New tab page leaves none). */
  retire(view: string): ClosedTab | undefined;
  readonly own: Pick<OwnViews, 'revive'>;
  readonly closed: Pick<Closed, 'take'>;
  live(): boolean;
};

/** Puts `next` in place; with a layer, offers Undo there. Returns the Undo itself (for tests). */
export function resetLayout(
  p: ResetParts,
  next: L.LayoutNode,
  layer?: HTMLElement | false,
): () => void {
  const was = p.root();
  const keep = new Set(L.views(next));
  const left = L.views(was)
    .filter((v) => !keep.has(v))
    .map((v) => [v, p.retire(v)] as const);
  p.set(next);
  const undo = (): void => {
    if (!p.live()) return;
    for (const [v, c] of left) p.own.revive(v, c && p.closed.take(c) ? c.state : undefined);
    p.set(was);
  };
  if (layer) toast(layer, t('pane.wasReset'), undo);
  return undo;
}
