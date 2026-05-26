export type NearEndSentinel = ReturnType<typeof createNearEndSentinel>;

export function createNearEndSentinel(args: {
  readonly root: () => Element | null | undefined;
  readonly sentinel: () => Element | null | undefined;
  readonly rootMargin: () => string;
  readonly enabled: () => boolean;
  readonly onNearEnd: () => void | Promise<void>;
}): {
  readonly observe: () => void;
  readonly disconnect: () => void;
} {
  let observer: IntersectionObserver | undefined;
  let firing = false;

  const disconnect = (): void => {
    observer?.disconnect();
    observer = undefined;
    firing = false;
  };

  const fire = (): void => {
    if (firing || !args.enabled()) return;
    firing = true;
    void Promise.resolve(args.onNearEnd()).finally(() => {
      firing = false;
    });
  };

  const observe = (): void => {
    disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    const root = args.root();
    const sentinel = args.sentinel();
    if (!root || !sentinel || !args.enabled()) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) fire();
      },
      { root, rootMargin: args.rootMargin(), threshold: 0 },
    );
    observer.observe(sentinel);
  };

  return { observe, disconnect };
}
