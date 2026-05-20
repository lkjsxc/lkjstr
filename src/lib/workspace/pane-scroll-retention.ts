export class PaneScrollRetention {
  #bodies = new Map<string, HTMLElement>();
  #scroll = new Map<string, number>();

  track(tabId: string, node: HTMLElement) {
    const remember = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.scrollTop > 0) this.#scroll.set(tabId, target.scrollTop);
    };
    this.#bodies.set(tabId, node);
    node.addEventListener('scroll', remember, true);
    return {
      destroy: () => {
        node.removeEventListener('scroll', remember, true);
        this.#bodies.delete(tabId);
      },
    };
  }

  remember(tabId: string): void {
    const top = this.#scrollable(tabId)?.scrollTop ?? 0;
    if (top > 0) this.#scroll.set(tabId, top);
  }

  restore(tabId: string): void {
    const top = this.#scroll.get(tabId);
    const body = this.#scrollable(tabId);
    if (top && body) requestAnimationFrame(() => (body.scrollTop = top));
  }

  #scrollable(tabId: string): HTMLElement | undefined {
    const body = this.#bodies.get(tabId);
    if (!body) return undefined;
    const scrollables = [
      body,
      ...body.querySelectorAll<HTMLElement>('*'),
    ].filter((node) => node.scrollHeight > node.clientHeight + 8);
    return scrollables.find((node) => node.scrollTop > 0) ?? scrollables.at(0);
  }
}
