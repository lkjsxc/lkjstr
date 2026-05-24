export type PaneScrollRetention = ReturnType<typeof createPaneScrollRetention>;

export function createPaneScrollRetention() {
  const bodies = new Map<string, HTMLElement>();
  const scroll = new Map<string, number>();
  const scrollable = (tabId: string): HTMLElement | undefined => {
    const body = bodies.get(tabId);
    if (!body) return undefined;
    const scrollables = [
      body,
      ...body.querySelectorAll<HTMLElement>('*'),
    ].filter((node) => node.scrollHeight > node.clientHeight + 8);
    return scrollables.find((node) => node.scrollTop > 0) ?? scrollables.at(0);
  };
  return {
    track: (tabId: string, node: HTMLElement) => {
      const remember = (event: Event) => {
        const target = event.target as HTMLElement;
        if (target.scrollTop > 0) scroll.set(tabId, target.scrollTop);
      };
      bodies.set(tabId, node);
      node.addEventListener('scroll', remember, true);
      return {
        destroy: () => {
          node.removeEventListener('scroll', remember, true);
          bodies.delete(tabId);
        },
      };
    },
    remember: (tabId: string): void => {
      const top = scrollable(tabId)?.scrollTop ?? 0;
      if (top > 0) scroll.set(tabId, top);
    },
    restore: (tabId: string): void => {
      const top = scroll.get(tabId);
      const body = scrollable(tabId);
      if (top && body) requestAnimationFrame(() => (body.scrollTop = top));
    },
  };
}
