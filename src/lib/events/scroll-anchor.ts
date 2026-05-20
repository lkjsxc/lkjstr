export type VirtualAnchor = {
  readonly key: string;
  readonly offset: number;
};

export type VirtualListHandle = {
  readonly getOffset?: () => number;
  readonly getItemOffset?: (index: number) => number;
  readonly scrollTo?: (offset: number) => void;
};

export function captureVirtualAnchor<T>(
  items: readonly T[],
  key: (item: T) => string,
  list?: VirtualListHandle,
): VirtualAnchor | undefined {
  const scrollOffset = list?.getOffset?.() ?? 0;
  let candidate: VirtualAnchor | undefined;
  for (const [index, item] of items.entries()) {
    const itemOffset = list?.getItemOffset?.(index) ?? index;
    if (itemOffset <= scrollOffset)
      candidate = { key: key(item), offset: scrollOffset - itemOffset };
    else break;
  }
  return (
    candidate ?? (items[0] ? { key: key(items[0]), offset: 0 } : undefined)
  );
}

export function restoreVirtualAnchor<T>(
  anchor: VirtualAnchor | undefined,
  items: readonly T[],
  key: (item: T) => string,
  list?: VirtualListHandle,
): void {
  if (!anchor || !list?.scrollTo) return;
  const index = items.findIndex((item) => key(item) === anchor.key);
  if (index < 0) return;
  const itemOffset = list.getItemOffset?.(index) ?? index;
  list.scrollTo(Math.max(0, itemOffset + anchor.offset));
}

export function capturePlainAnchor(
  container: HTMLElement,
  selector = '[data-scroll-key]',
): VirtualAnchor | undefined {
  const containerTop = container.getBoundingClientRect().top;
  const nodes = [...container.querySelectorAll<HTMLElement>(selector)];
  const node = nodes.find(
    (item) => item.getBoundingClientRect().bottom >= containerTop,
  );
  const key = node?.dataset.scrollKey;
  if (!node || !key) return undefined;
  return { key, offset: containerTop - node.getBoundingClientRect().top };
}

export function restorePlainAnchor(
  container: HTMLElement,
  anchor: VirtualAnchor | undefined,
  selector = '[data-scroll-key]',
): void {
  if (!anchor) return;
  const escaped = cssEscape(anchor.key);
  const node = container.querySelector<HTMLElement>(
    `${selector}[data-scroll-key="${escaped}"]`,
  );
  if (!node) return;
  const delta =
    node.getBoundingClientRect().top - container.getBoundingClientRect().top;
  container.scrollTop += delta - anchor.offset;
}

export function compensateHeightDelta(
  container: HTMLElement,
  changedNode: HTMLElement,
  previousHeight: number,
  nextHeight: number,
): void {
  if (changedNode.offsetTop < container.scrollTop)
    container.scrollTop += nextHeight - previousHeight;
}

function cssEscape(value: string): string {
  return typeof CSS === 'undefined' ? value : CSS.escape(value);
}
