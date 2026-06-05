<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    estimateFeedRowHeight,
    recordFeedRowHeight,
    widthBucketForPx,
  } from '$lib/feed-surface/row-height-reservation';

  type Props = {
    item: unknown;
    getKey: (item: unknown) => string;
    scrollElement?: HTMLElement;
    row: Snippet<[item: unknown]>;
  };

  let { item, getKey, scrollElement, row }: Props = $props();
  let element: HTMLDivElement | undefined;
  let widthPx = $state<number | undefined>();
  let key = $derived(getKey(item));
  let reservedHeight = $derived(estimateFeedRowHeight({ key, item, widthPx }));

  $effect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const node = element;
    const initial = node.getBoundingClientRect();
    let previousHeight = Math.round(initial.height);
    let previousBucket = widthBucketForPx(initial.width);
    widthPx = initial.width;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const height = Math.round(rect?.height ?? 0);
      const width = Math.round(rect?.width ?? 0);
      if (width > 0) widthPx = width;
      const bucket = widthBucketForPx(width);
      if (bucket !== previousBucket) {
        previousBucket = bucket;
        previousHeight = height;
        return;
      }
      if (height <= 0 || height === previousHeight) return;
      const delta = height - previousHeight;
      if (isAboveViewport(node, scrollElement) && delta !== 0)
        scrollElement!.scrollTop += delta;
      previousHeight = height;
      recordFeedRowHeight({ key, item, widthPx: width, heightPx: height });
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
