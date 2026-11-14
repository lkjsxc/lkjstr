// The short lists of the Relays tab and of Settings (relays, mutes, media servers): the rows of one subscription,
// drawn so that a row that did not change keeps its node and the keyboard stays on the control it was on.
import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Row, Source } from '../engine/protocol.ts';
import type { Disposer } from '../shared/signal.ts';
import type { ViewEnv } from './registry.ts';

const MOST = 500; // bound: rows of one short list

/** Follows a finite source as the active account. `draw` gets every state of the list; `loaded` is false until
 * the engine has answered once. */
export function watchList(
  env: ViewEnv,
  source: Source,
  draw: (rows: readonly Row[], loaded: boolean) => void,
): Disposer {
  let sub: Subscription | undefined;
  let rows: readonly Row[] = [];
  let as: string | undefined;
  const open = (): void => {
    const me = env.engine.me();
    if (sub && me === as) return;
    sub?.close();
    as = me;
    rows = [];
    draw(rows, false);
    sub = env.engine.open(
      { source, account: me || undefined },
      {
        rows: (r) => draw((rows = r), true),
        patch: (ops) => draw((rows = applyOps(rows, ops)), true),
      },
    );
    sub.window('top', 0, MOST);
    sub.visible(env.visible.get());
  };
  const offs = [
    env.engine.accounts.subscribe(open),
    env.visible.subscribe((on) => sub?.visible(on)),
  ];
  open();
  return () => {
    for (const off of offs) off();
    sub?.close();
  };
}

export type Keyed = Map<string, { sig: string; node: HTMLElement }>;
/** Puts the nodes of `rows` into `parent` in order. A control is named by `data-f`; when its row is redrawn the
 * same control of the new node takes the focus, and when its row is gone the row that took its place does. */
export function reconcile<R extends { readonly key: string }>(
  parent: HTMLElement,
  cache: Keyed,
  rows: readonly R[],
  render: (row: R) => HTMLElement,
): void {
  const active = document.activeElement;
  const held = active instanceof HTMLElement && parent.contains(active) ? active : undefined;
  const heldRow = held?.closest<HTMLElement>('[data-key]');
  const heldAt = heldRow ? [...parent.children].indexOf(heldRow) : -1;
  const want: HTMLElement[] = [];
  const seen = new Set<string>(); // bound: the rows of this draw
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    const sig = JSON.stringify(row);
    let c = cache.get(row.key);
    if (!c || c.sig !== sig) {
      c = { sig, node: render(row) };
      c.node.dataset.key = row.key;
      cache.set(row.key, c);
    }
    want.push(c.node);
  }
  for (const key of [...cache.keys()]) if (!seen.has(key)) cache.delete(key);
  want.forEach((node, i) => {
    if (parent.children[i] !== node) parent.insertBefore(node, parent.children[i] ?? null);
  });
  while (parent.children.length > want.length) parent.lastElementChild?.remove();
  if (!held || held.isConnected) return;
  const name = held.dataset.f;
  const same = cache.get(heldRow?.dataset.key ?? '')?.node;
  const next = same ?? want[Math.min(heldAt, want.length - 1)];
  const to =
    next?.querySelector<HTMLElement>(`[data-f="${name}"]:not(:disabled)`) ??
    next?.querySelector<HTMLElement>('[data-f]:not(:disabled)') ??
    parent.closest<HTMLElement>('[tabindex]');
  to?.focus({ preventScroll: true });
}
