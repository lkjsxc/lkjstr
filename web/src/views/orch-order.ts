// Rows that hold still: a band reorders at most once every five seconds, and never while the pointer or the
// keyboard is inside it, so nothing moves under the reader. New keys join at the end; gone keys leave at once.
const EVERY_MS = 5000;

export function createSteadyOrder(band: HTMLElement) {
  let order: string[] = []; // bound: the rows the engine reports for this band
  let at = Number.NEGATIVE_INFINITY;
  const held = (): boolean => band.matches(':hover') || band.contains(document.activeElement);
  return (want: readonly string[], now = performance.now()): string[] => {
    const live = new Set(want);
    if (now - at >= EVERY_MS && !held()) {
      at = now;
      order = [...want];
      return order;
    }
    order = order.filter((k) => live.has(k));
    for (const k of want) if (!order.includes(k)) order.push(k);
    return order;
  };
}

/** Puts `nodes` into `parent` in that order, moving only what is out of place. */
export function place(parent: HTMLElement, nodes: readonly HTMLElement[]): void {
  nodes.forEach((n, i) => {
    if (parent.children[i] !== n) parent.insertBefore(n, parent.children[i] ?? null);
  });
  while (parent.children.length > nodes.length) parent.lastElementChild?.remove();
}
