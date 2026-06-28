export type EventTreeListNearEndObserver = {
  observe(target: Element): void;
  disconnect(): void;
};

export type CreateEventTreeListNearEndObserver = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => EventTreeListNearEndObserver;

export type EventTreeListNearEndSentinel = {
  observe(): void;
  disconnect(): void;
};

export type EventTreeListNearEndSentinelInput = {
  root: () => Element | null | undefined;
  sentinel: () => Element | null | undefined;
  rootMargin: () => string;
  enabled: () => boolean;
  onNearEnd: () => void | Promise<void>;
  createObserver?: CreateEventTreeListNearEndObserver;
};

export function createEventTreeListNearEndSentinel(
  input: EventTreeListNearEndSentinelInput,
): EventTreeListNearEndSentinel {
  let observer: EventTreeListNearEndObserver | undefined;
  let firing = false;

  const disconnect = (): void => {
    observer?.disconnect();
    observer = undefined;
    firing = false;
  };

  const fire = (): void => {
    if (firing || !input.enabled()) return;
    firing = true;
    void Promise.resolve()
      .then(() => input.onNearEnd())
      .finally(() => {
        firing = false;
      });
  };

  const observe = (): void => {
    disconnect();
    if (!input.enabled()) return;
    const root = input.root();
    const sentinel = input.sentinel();
    if (!root || !sentinel) return;
    const createObserver = input.createObserver ?? defaultObserver;
    if (!createObserver) return;
    observer = createObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) fire();
      },
      { root, rootMargin: input.rootMargin(), threshold: 0 },
    );
    observer.observe(sentinel);
  };

  return { observe, disconnect };
}

const defaultObserver: CreateEventTreeListNearEndObserver | undefined =
  typeof IntersectionObserver === 'undefined'
    ? undefined
    : (callback, options) => new IntersectionObserver(callback, options);
