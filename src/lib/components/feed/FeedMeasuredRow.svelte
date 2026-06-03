<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    estimateFeedRowHeight,
    recordFeedRowHeight,
  } from '$lib/feed-surface/row-height-reservation';

  type Props = {
    item: unknown;
    getKey: (item: unknown) => string;
    scrollElement?: HTMLElement;
    row: Snippet<[item: unknown]>;
  };

  let { item, getKey, scrollElement, row }: Props = $props();
  let element: HTMLDivElement | undefined;
  let key = $derived(getKey(item));
  let reservedHeight = $derived(estimateFeedRowHeight({ key, item }));

  $effect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const node = element;
    let previous = Math.round(node.getBoundingClientRect().height);
    const observer = new ResizeObserver((entries) => {
      const height = Math.round(entries[0]?.contentRect.height ?? 0);
      if (height <= 0 || height === previous) return;
      const delta = height - previous;
      if (isAboveViewport(node, scrollElement) && delta !== 0)
        scrollElement!.scrollTop += delta;
      previous = height;
      recordFeedRowHeight({ key, heightPx: height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  });

  function isAboveViewport(
    node: HTMLElement,
    scroll: HTMLElement | undefined,
  ): boolean {
    if (!scroll) return false;
    return (
      node.getBoundingClientRect().bottom < scroll.getBoundingClientRect().top
    );
  }
</script>

<div
  bind:this={element}
  class="feed-scroll-item"
  style={`min-height: ${reservedHeight}px;`}
>
  {@render row(item)}
</div>
