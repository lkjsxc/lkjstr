export type PaneScrollRetention = ReturnType<typeof createPaneScrollRetention>;
export type PaneScrollSnapshot = {
  readonly scrollTop?: number;
};

export function createPaneScrollRetention() {
  const bodies = new Map<string, HTMLElement>();
  const scroll = new Map<string, number>();
  const scrollables = (tabId: string): HTMLElement[] => {
    const body = bodies.get(tabId);
    if (!body) return [];
    return [
      body,
      ...body.querySelectorAll<HTMLElement>('*'),
    ].filter((node) => node.scrollHeight > node.clientHeight + 8);
  };
  const scrollable = (tabId: string): HTMLElement | undefined => {
    const nodes = scrollables(tabId);
    return nodes.find((node) => node.scrollTop > 0) ?? nodes.at(0);
  };
  return {
    track: (tabId: string, node: HTMLElement) => {
      const remember = (event: Event) => {
        const target = event.target as HTMLElement;
        if (target.scrollTop > 0) scroll.set(tabId, target.scrollTop);
      };
      bodies.set(tabId, node);
      node.addEventListener('scroll', remember, true);
      const top = scroll.get(tabId);
      if (top)
        requestAnimationFrame(() => {
          for (const target of scrollables(tabId)) target.scrollTop = top;
        });
      return {
        destroy: () => {
          const top = scrollable(tabId)?.scrollTop ?? 0;
          if (top > 0) scroll.set(tabId, top);
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
      if (top)
        requestAnimationFrame(() => {
          for (const target of scrollables(tabId)) target.scrollTop = top;
        });
    },
    snapshot: (tabId: string): PaneScrollSnapshot => ({
      scrollTop: scroll.get(tabId),
    }),
    restoreSnapshot: (tabId: string, snapshot?: PaneScrollSnapshot): void => {
      if (snapshot?.scrollTop) scroll.set(tabId, snapshot.scrollTop);
    },
  };
}
