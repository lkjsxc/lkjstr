<script lang="ts">
  import type { Snippet } from 'svelte';
  import { featuresForFeedItem } from '$lib/feed-surface/feed-geometry-features';
  import {
    estimateFeedRowHeight,
    markFeedRowDematerialized,
    markFeedRowMaterialized,
    recordFeedRowAnchorCompensation,
    recordFeedRowHeight,
    widthBucketForPx,
  } from '$lib/feed-surface/row-height-reservation';

  type Props = {
    item: unknown;
    getKey: (item: unknown) => string;
    scrollElement?: HTMLElement;
    surfaceWidthPx?: number;
    row: Snippet<[item: unknown]>;
  };

  let { item, getKey, scrollElement, surfaceWidthPx, row }: Props = $props();
  let element: HTMLDivElement | undefined;
  let widthPx = $state<number | undefined>(surfaceWidthPx);
  let measuredHeight = $state(0);
  let key = $derived(getKey(item));
  let reservedHeight = $derived(estimateFeedRowHeight({ key, item, widthPx }));
  let widthBucket = $derived(widthBucketForPx(widthPx));
  let heightGap = $derived(Math.max(0, reservedHeight - measuredHeight));
  let contentShape = $derived(
    featuresForFeedItem(item, widthPx, 'enriched').contentShapeHash,
  );
  let gapClassification = $derived(heightGap > 8 ? 'reservation-gap' : 'none');

  $effect(() => {
    if (surfaceWidthPx && surfaceWidthPx > 0) widthPx = surfaceWidthPx;
  });

  $effect(() => {
    markFeedRowMaterialized(key);
    return () => markFeedRowDematerialized(key);
  });

  $effect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const node = element;
    const initial = node.getBoundingClientRect();
    let previousHeight = Math.round(initial.height);
    let previousBucket = widthBucketForPx(initial.width);
    widthPx = initial.width;
    measuredHeight = previousHeight;
    if (previousHeight > 0)
      recordFeedRowHeight({
        key,
        item,
        widthPx: initial.width,
        heightPx: previousHeight,
      });
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const height = Math.round(rect?.height ?? 0);
      const width = Math.round(rect?.width ?? 0);
      if (width > 0) widthPx = width;
      const bucket = widthBucketForPx(width);
      if (height <= 0) return;
      measuredHeight = height;
      const bucketChanged = bucket !== previousBucket;
      const delta = height - previousHeight;
      if (bucketChanged) previousBucket = bucket;
      if (delta !== 0 && isAboveViewport(node, scrollElement)) {
        scrollElement!.scrollTop += delta;
        recordFeedRowAnchorCompensation();
      }
      previousHeight = height;
      if (bucketChanged || delta !== 0)
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
  data-row-key={key}
  data-reserved-height={reservedHeight}
  data-measured-height={measuredHeight}
  data-content-height={measuredHeight}
  data-width-bucket={widthBucket}
  data-materialization-tier="enriched"
  data-content-shape={contentShape}
  data-height-gap={heightGap}
  data-gap-classification={gapClassification}
  style={`min-height: ${reservedHeight}px;`}
>
  {#if item !== undefined && item !== null}
    {@render row(item)}
  {/if}
</div>
