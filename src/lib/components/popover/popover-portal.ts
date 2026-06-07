export function popoverPortalHost(anchor: HTMLElement): HTMLElement {
  const pane = anchor.closest('[data-pane-id]');
  const tileHost = pane?.querySelector('.pane-stack');
  if (tileHost instanceof HTMLElement) return tileHost;
  if (pane instanceof HTMLElement) return pane;
  return document.body;
}

export function mountPopoverPortal(
  anchor: HTMLElement,
  node: HTMLElement,
): () => void {
  const host = popoverPortalHost(anchor);
  host.append(node);
  return () => node.remove();
}
