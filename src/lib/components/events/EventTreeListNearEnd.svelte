<script lang="ts">
  import { planEventTreeListNearEnd } from './event-tree-list-near-end-plan';
  import { createEventTreeListNearEndSentinel } from './event-tree-list-near-end-sentinel';

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
</script>

<div
  class="event-list__near-end-sentinel"
  bind:this={sentinelElement}
  aria-hidden="true"
></div>
