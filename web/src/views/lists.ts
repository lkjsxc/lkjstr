// The short lists of the Relays tab and of Settings (relays, mutes, media servers): the rows of one subscription,
// drawn so that a row that did not change keeps its node and the keyboard stays on the control it was on.
import type { Subscription } from '../engine/client.ts';
import type { Row, Source } from '../engine/protocol.ts';
import type { Disposer } from '../shared/signal.ts';
import type { ViewEnv } from './registry.ts';

const MOST = 500; // Batch size; collect until the source reports exhaustion.

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
  let pending = true;
  let initial = true;
  const collected = new Map<string, Row>();
  let generation = 0;
  let requestSerial = 0;
  const request = (anchor: 'top' | { key: string }): void => {
    pending = true;
    const current = generation;
    const serial = ++requestSerial;
    queueMicrotask(() => {
      if (current === generation && serial === requestSerial) sub?.window(anchor, 0, MOST);
    });
  };
  const open = (): void => {
    const me = env.engine.me();
    if (sub && me === as) return;
    sub?.close();
    generation++;
    pending = initial = true;
    as = me;
    rows = [];
    collected.clear();
    draw(rows, false);
    sub = env.engine.open(
      { source, account: me || undefined },
      {
        rows: (r, top = true, bottom = true) => {
          // The real engine also sends its default 50-row open response before our window.
          if (initial && top && r.length === 50 && !bottom) return;
          initial = false;
          if (!pending && !(top && bottom)) return request('top');
          pending = false;
          if (top) collected.clear();
          for (const row of r) collected.set(row.key, row);
          // Bound: membership of the finite source on this device. Swap complete snapshots
          // so refreshing a later page never removes the row holding the keyboard.
          if (bottom) draw((rows = [...collected.values()]), true);
          const last = r.at(-1);
          if (!bottom && last) request({ key: last.key });
        },
        patch: () => request('top'),
      },
    );
    request('top');
    sub.visible(env.visible.get());
  };
  const offs = [
    env.engine.accounts.subscribe(open),
    env.visible.subscribe((on) => sub?.visible(on)),
  ];
  open();
  return () => {
    generation++;
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
    if (
      (!c || c.sig !== sig) &&
      !(c && active && c.node.contains(active) && active.matches('input, textarea, select'))
    ) {
      const faces = c ? [...c.node.querySelectorAll<HTMLElement>('[data-face]')] : [];
      c = { sig, node: render(row) };
      for (const face of c.node.querySelectorAll<HTMLElement>('[data-face]')) {
        const old = faces.find((old) => old.dataset.face === face.dataset.face);
        if (old) face.replaceWith(old);
      }
      c.node.dataset.key = row.key;
      cache.set(row.key, c);
    }
    if (c) want.push(c.node);
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
