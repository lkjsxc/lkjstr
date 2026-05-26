<script lang="ts">
  import { nearEndRootMargin } from '$lib/feed-surface/near-end';
  import { createNearEndSentinel } from '$lib/feed-surface/near-end-observer';

  type Props = {
    enabled: boolean;
    viewportHeight: number;
    onNearEnd?: () => void | Promise<void>;
    scroller?: HTMLElement;
  };

  let props: Props = $props();
  let sentinelElement: HTMLDivElement | undefined;
  const nearEndSentinel = createNearEndSentinel({
    root: () => props.scroller,
    sentinel: () => sentinelElement,
    rootMargin: () => nearEndRootMargin(props.viewportHeight),
    enabled: () => props.enabled && Boolean(props.onNearEnd),
    onNearEnd: () => props.onNearEnd?.(),
  });

  $effect(() => {
    props.enabled;
    props.scroller;
    nearEndSentinel.observe();
    return () => nearEndSentinel.disconnect();
  });
</script>

<div
  class="event-list__near-end-sentinel"
  bind:this={sentinelElement}
  aria-hidden="true"
></div>
