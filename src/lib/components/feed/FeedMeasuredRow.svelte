<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { featuresForFeedItem } from '$lib/feed-surface/feed-geometry-features';
  import {
    estimateFeedRowHeight,
    markFeedRowDematerialized,
    markFeedRowMaterialized,
    recordFeedRowAnchorCompensation,
    recordFeedRowHeight,
    recordFeedRowStaleObservation,
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
  let contentElement: HTMLDivElement | undefined;
  let widthPx = $state<number | undefined>();
  let measuredHeight = $state(0);
  let measurementGeneration = $state(0);
  let appliedReservedHeight = $state(0);
  let appliedReservationKey = $state('');
  let key = $derived(getKey(item));
  let reservedHeight = $derived.by(() => {
    void measurementGeneration;
    return estimateFeedRowHeight({ key, item, widthPx });
  });
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
    const nextKey = key;
    const nextReservedHeight = reservedHeight;
    const previousKey = untrack(() => appliedReservationKey);
    const previousHeight = untrack(() => appliedReservedHeight);
    if (previousKey !== nextKey) {
      appliedReservationKey = nextKey;
      if (previousHeight !== nextReservedHeight)
        appliedReservedHeight = nextReservedHeight;
      return;
    }
    const delta = nextReservedHeight - previousHeight;
    if (delta < 0 && element && isAboveViewport(element, scrollElement)) {
      recordFeedRowAnchorCompensation(delta);
    }
    if (previousHeight !== nextReservedHeight)
      appliedReservedHeight = nextReservedHeight;
  });

  $effect(() => {
    if (!element || !contentElement || typeof ResizeObserver === 'undefined')
      return;
    const node = element;
    const contentNode = contentElement;
    const initial = contentNode.getBoundingClientRect();
    let previousHeight = Math.round(initial.height);
    let previousBucket = widthBucketForPx(initial.width);
    widthPx = initial.width;
    measuredHeight = previousHeight;
    if (previousHeight > 0) {
      recordFeedRowHeight({
        key,
        item,
        widthPx: initial.width,
        heightPx: previousHeight,
      });
      bumpMeasurementGeneration();
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const height = Math.round(rect?.height ?? 0);
      const width = Math.round(rect?.width ?? 0);
      if (width > 0) widthPx = width;
      const bucket = widthBucketForPx(width);
      if (height <= 0) {
        recordFeedRowStaleObservation();
        return;
      }
      measuredHeight = height;
      const bucketChanged = bucket !== previousBucket;
      const delta = height - previousHeight;
      if (bucketChanged) previousBucket = bucket;
      if (delta !== 0 && isAboveViewport(node, scrollElement)) {
        recordFeedRowAnchorCompensation(delta);
      }
      previousHeight = height;
      if (bucketChanged || delta !== 0) {
        recordFeedRowHeight({ key, item, widthPx: width, heightPx: height });
        bumpMeasurementGeneration();
      }
    });
    observer.observe(contentNode);
    return () => observer.disconnect();
  });

  function bumpMeasurementGeneration(): void {
    measurementGeneration = untrack(() => measurementGeneration) + 1;
  }

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
  <div bind:this={contentElement} class="feed-scroll-item__content">
    {#if item !== undefined && item !== null}
      {@render row(item)}
    {/if}
  </div>
</div>
