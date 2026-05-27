<script lang="ts">
  import type { Snippet } from 'svelte';
  import { VList } from 'virtua/svelte';
  import EventTreeListNearEnd from '$lib/components/events/EventTreeListNearEnd.svelte';
  import { isNearEnd } from '$lib/feed-surface/near-end';

  export type FeedScrollListHandle = {
    getViewportSize?: () => number;
    getScrollSize?: () => number;
    getItemOffset?: (index: number) => number;
    scrollToIndex?: (index: number) => void;
  };

  type Props = {
    data: readonly unknown[];
    getKey: (item: unknown) => string;
    viewportClass: string;
    scrollerClass: string;
    nearEndEnabled?: boolean;
    onNearEnd?: () => void | Promise<void>;
    onScrollOffset?: (offset: number) => void;
    list?: FeedScrollListHandle;
    scrollerElement?: HTMLDivElement;
    scrollElement?: HTMLElement;
    row: Snippet<[item: unknown]>;
  };

  let {
    data,
    getKey,
    viewportClass,
    scrollerClass,
    nearEndEnabled = false,
    onNearEnd,
    onScrollOffset,
    list = $bindable(),
    scrollerElement = $bindable(),
    scrollElement = $bindable(),
    row,
  }: Props = $props();

  let viewportHeight = $derived(
    list?.getViewportSize?.() ?? scrollerElement?.clientHeight ?? 0,
  );

  function handleScroll(offset: number): void {
    onScrollOffset?.(offset);
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    if (nearEndEnabled && data.length > 0 && isNearEnd(offset, viewport, total))
      void onNearEnd?.();
  }

  $effect(() => {
    if (!scrollerElement) return;
    scrollElement =
      scrollerElement.querySelector<HTMLElement>('[data-scroll-owner]') ??
      scrollerElement;
  });
</script>

<div class={scrollerClass} bind:this={scrollerElement}>
  <VList
    bind:this={list}
    class={viewportClass}
    {...{ 'data-scroll-owner': '' }}
    {data}
    style="height: 100%; min-height: 0;"
    {getKey}
    onscroll={handleScroll}
  >
    {#snippet children(item)}
      <div class="feed-scroll-item">
        {@render row(item)}
      </div>
    {/snippet}
  </VList>
  <EventTreeListNearEnd
    enabled={nearEndEnabled}
    {viewportHeight}
    {onNearEnd}
    scroller={scrollerElement}
  />
</div>
