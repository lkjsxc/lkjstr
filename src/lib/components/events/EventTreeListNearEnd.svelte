<script lang="ts">
  import { planEventTreeListNearEnd } from './event-tree-list-near-end-plan';

  type Props = {
    enabled: boolean;
    viewportHeight: number;
    onNearEnd?: () => void | Promise<void>;
    scroller?: HTMLElement;
  };

  let props: Props = $props();
  let sentinelElement: HTMLDivElement | undefined;
  let plan = $derived(planEventTreeListNearEnd(props));
  const nearEndSentinel = createEventTreeListNearEndSentinel({
    root: () => props.scroller,
    sentinel: () => sentinelElement,
    rootMargin: () => plan.rootMargin,
    enabled: () => plan.enabled,
    onNearEnd: () => props.onNearEnd?.(),
  });

  $effect(() => {
    const next = plan;
    if (!next.shouldObserve) return () => nearEndSentinel.disconnect();
    nearEndSentinel.observe();
    return () => nearEndSentinel.disconnect();
  });

  function createEventTreeListNearEndSentinel(args: {
    root: () => Element | null | undefined;
    sentinel: () => Element | null | undefined;
    rootMargin: () => string;
    enabled: () => boolean;
    onNearEnd: () => void | Promise<void>;
  }) {
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
</script>

<div
  class="event-list__near-end-sentinel"
  bind:this={sentinelElement}
  aria-hidden="true"
></div>
