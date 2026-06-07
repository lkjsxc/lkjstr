export type PaneScrollRetention = ReturnType<typeof createPaneScrollRetention>;
export type PaneScrollSnapshot = {
  readonly scrollTop?: number;
};

export function createPaneScrollRetention() {
  const bodies = new Map<string, HTMLElement>();
  const scroll = new Map<string, number>();
  const pendingRestore = new Map<string, number>();

  const scrollOwner = (tabId: string): HTMLElement | undefined => {
    const body = bodies.get(tabId);
    if (!body) return undefined;
    const owners = body.querySelectorAll<HTMLElement>('[data-scroll-owner]');
    if (owners.length !== 1) return undefined;
    const owner = owners[0];
    if (!belongsToTabBody(owner, body, tabId)) return undefined;
    owner.setAttribute?.('data-scroll-owner-tab-id', tabId);
    return owner;
  };

  const belongsToTabBody = (
    owner: HTMLElement,
    body: HTMLElement,
    tabId: string,
  ): boolean => {
    const declared = owner.getAttribute?.('data-scroll-owner-tab-id');
    if (declared && declared !== tabId) return false;
    const closest = owner.closest?.('[data-tab-id]') as
      | HTMLElement
      | null
      | undefined;
    return !closest || closest === body;
  };

  const rememberTop = (tabId: string, top: number): void => {
    const pending = pendingRestore.get(tabId);
    if (pending !== undefined && pending > 0 && top === 0) return;
    scroll.set(tabId, top);
    if (pending !== undefined && Math.abs(top - pending) <= 1)
      pendingRestore.delete(tabId);
  };

  const applyScrollTop = (tabId: string, top: number): boolean => {
    const owner = scrollOwner(tabId);
    if (!owner) return false;
    owner.scrollTop = top;
    const applied = top === 0 || Math.abs(owner.scrollTop - top) <= 1;
    if (applied) pendingRestore.delete(tabId);
    return applied;
  };

  const scheduleFrame = (callback: () => void): void => {
    if (typeof requestAnimationFrame === 'function')
      requestAnimationFrame(callback);
    else queueMicrotask(callback);
  };

  const scheduleRestore = (tabId: string, top: number): void => {
    pendingRestore.set(tabId, top);
    let remaining = 30;
    const apply = () => {
      if (applyScrollTop(tabId, top) || remaining <= 0) return;
      remaining -= 1;
      scheduleFrame(apply);
    };
    scheduleFrame(apply);
  };

  return {
    track: (tabId: string, node: HTMLElement) => {
      const remember = (event: Event) => {
        const target = event.target as HTMLElement;
        if (!target.hasAttribute?.('data-scroll-owner')) return;
        if (target !== scrollOwner(tabId)) return;
        rememberTop(tabId, target.scrollTop);
      };
      bodies.set(tabId, node);
      node.addEventListener('scroll', remember, true);
      if (scroll.has(tabId)) scheduleRestore(tabId, scroll.get(tabId)!);
      return {
        destroy: () => {
          const owner = scrollOwner(tabId);
          if (owner) rememberTop(tabId, owner.scrollTop);
          node.removeEventListener('scroll', remember, true);
          bodies.delete(tabId);
        },
      };
    },
    remember: (tabId: string): void => {
      const owner = scrollOwner(tabId);
      if (owner) rememberTop(tabId, owner.scrollTop);
    },
    hasTracked: (tabId: string): boolean => bodies.has(tabId),
    hasRememberedScroll: (tabId: string): boolean =>
      scroll.has(tabId) || pendingRestore.has(tabId),
    restore: (tabId: string): void => {
      const top = pendingRestore.get(tabId) ?? scroll.get(tabId);
      if (top === undefined) return;
      scheduleRestore(tabId, top);
    },
    snapshot: (tabId: string): PaneScrollSnapshot => ({
      scrollTop: pendingRestore.get(tabId) ?? scroll.get(tabId),
    }),
    restoreSnapshot: (tabId: string, snapshot?: PaneScrollSnapshot): void => {
      if (snapshot?.scrollTop === undefined) return;
      scroll.set(tabId, snapshot.scrollTop);
      scheduleRestore(tabId, snapshot.scrollTop);
    },
  };
}
