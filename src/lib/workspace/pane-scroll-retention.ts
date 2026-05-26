export type PaneScrollRetention = ReturnType<typeof createPaneScrollRetention>;
export type PaneScrollSnapshot = {
  readonly scrollTop?: number;
};

export function createPaneScrollRetention() {
  const bodies = new Map<string, HTMLElement>();
  const scroll = new Map<string, number>();

  const scrollOwner = (tabId: string): HTMLElement | undefined => {
    const body = bodies.get(tabId);
    if (!body) return undefined;
    return (
      body.querySelector<HTMLElement>('[data-scroll-owner]') ??
      body.querySelector<HTMLElement>('.event-list__viewport') ??
      [...body.querySelectorAll<HTMLElement>('*')].find(
        (node) => node.scrollHeight > node.clientHeight + 8,
      )
    );
  };

  const applyScrollTop = (tabId: string, top: number): void => {
    const owner = scrollOwner(tabId);
    if (owner) owner.scrollTop = top;
  };

  return {
    track: (tabId: string, node: HTMLElement) => {
      const remember = (event: Event) => {
        const target = event.target as HTMLElement;
        if (
          !target.hasAttribute('data-scroll-owner') &&
          !target.classList.contains('event-list__viewport')
        )
          return;
        scroll.set(tabId, target.scrollTop);
      };
      bodies.set(tabId, node);
      node.addEventListener('scroll', remember, true);
      if (scroll.has(tabId))
        requestAnimationFrame(() => applyScrollTop(tabId, scroll.get(tabId)!));
      return {
        destroy: () => {
          const owner = scrollOwner(tabId);
          if (owner) scroll.set(tabId, owner.scrollTop);
          node.removeEventListener('scroll', remember, true);
          bodies.delete(tabId);
        },
      };
    },
    remember: (tabId: string): void => {
      const owner = scrollOwner(tabId);
      if (owner) scroll.set(tabId, owner.scrollTop);
    },
    hasTracked: (tabId: string): boolean => bodies.has(tabId),
    hasRememberedScroll: (tabId: string): boolean => scroll.has(tabId),
    restore: (tabId: string): void => {
      if (!scroll.has(tabId)) return;
      const top = scroll.get(tabId)!;
      requestAnimationFrame(() => applyScrollTop(tabId, top));
    },
    snapshot: (tabId: string): PaneScrollSnapshot => ({
      scrollTop: scroll.get(tabId),
    }),
    restoreSnapshot: (tabId: string, snapshot?: PaneScrollSnapshot): void => {
      if (snapshot?.scrollTop !== undefined)
        scroll.set(tabId, snapshot.scrollTop);
    },
  };
}
